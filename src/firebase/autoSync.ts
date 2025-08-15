// src/firebase/autoSync.ts - Sistema automático de sincronización Web ↔ Móvil
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
  getDocs,
  addDoc
} from "firebase/firestore";
import { db } from "./index";
import type { FirebaseGroup } from "./index";

// Estructura unificada de grupo (compatible web-móvil)
export interface UnifiedGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[]; // emails
  membersUids?: string[]; // UIDs para móvil
  pendingInvitations: string[];
  createdAt: Date;
  isAutoSynced: boolean;
  lastSyncUpdate?: Date;
  mobileGroupId?: string; // Referencia cruzada
}

// Interface para mapeo de sincronización
interface AutoSyncMapping {
  webGroupId: string;
  mobileGroupId: string;
  userEmail: string;
  userUid: string;
  lastSync: Date;
}

/**
 * FUNCIÓN PRINCIPAL: Crear grupo con auto-sincronización
 */
export const createAutoSyncGroup = async (groupData: {
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  pendingInvitations: string[];
}): Promise<string> => {
  try {
    console.log('🚀 Creando grupo con auto-sync:', groupData.name);
    
    // 1. Obtener UIDs de los miembros
    const membersWithUids = await getUserUids(groupData.members);
    
    // 2. Crear grupo en colección 'circulos' (web)
    const webGroupData: Omit<UnifiedGroup, 'id'> = {
      ...groupData,
      membersUids: membersWithUids.map(m => m.uid),
      isAutoSynced: true,
      createdAt: new Date(),
      lastSyncUpdate: new Date()
    };
    
    const webGroupRef = doc(collection(db, 'circulos'));
    await setDoc(webGroupRef, webGroupData);
    const webGroupId = webGroupRef.id;
    
    // 3. Crear grupo en colección móvil (estructura móvil compatible)
    const mobileGroupData = {
      id: webGroupId, // MISMO ID para sincronización
      name: groupData.name,
      description: groupData.description,
      createdBy: groupData.createdBy,
      members: membersWithUids.map(m => ({
        uid: m.uid,
        email: m.email,
        name: m.name,
        role: m.email === groupData.createdBy ? 'admin' : 'member',
        joinedAt: new Date()
      })),
      pendingInvites: groupData.pendingInvitations,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedFromWeb: true
    };
    
    // IMPORTANTE: Usar el MISMO ID en ambas colecciones
    await setDoc(doc(db, 'mobile_groups', webGroupId), mobileGroupData);
    
    // 4. Actualizar referencia cruzada
    await updateDoc(doc(db, 'circulos', webGroupId), {
      mobileGroupId: webGroupId
    });
    
    console.log('✅ Grupo creado y sincronizado automáticamente:', webGroupId);
    return webGroupId;
    
  } catch (error) {
    console.error('❌ Error creando grupo auto-sync:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Agregar miembro con auto-sincronización
 */
export const addMemberAutoSync = async (groupId: string, memberEmail: string): Promise<void> => {
  try {
    console.log('👥 Agregando miembro con auto-sync:', memberEmail, 'al grupo:', groupId);
    
    // 1. Verificar que el usuario existe
    const userInfo = await getUserUid(memberEmail);
    if (!userInfo) {
      throw new Error('El usuario no está registrado en el sistema');
    }
    
    const batch = writeBatch(db);
    
    // 2. Actualizar grupo web (circulos)
    const webGroupRef = doc(db, 'circulos', groupId);
    batch.update(webGroupRef, {
      members: arrayUnion(memberEmail),
      membersUids: arrayUnion(userInfo.uid),
      lastSyncUpdate: new Date()
    });
    
    // 3. Actualizar grupo móvil
    const mobileGroupRef = doc(db, 'mobile_groups', groupId);
    const newMobileMemeber = {
      uid: userInfo.uid,
      email: memberEmail,
      name: userInfo.name,
      role: 'member',
      joinedAt: new Date()
    };
    
    batch.update(mobileGroupRef, {
      members: arrayUnion(newMobileMemeber),
      updatedAt: new Date()
    });
    
    await batch.commit();
    
    console.log('✅ Miembro agregado en ambas plataformas:', memberEmail);
    
  } catch (error) {
    console.error('❌ Error agregando miembro auto-sync:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Remover miembro con auto-sincronización
 */
export const removeMemberAutoSync = async (groupId: string, memberEmail: string): Promise<void> => {
  try {
    console.log('🗑️ Removiendo miembro con auto-sync:', memberEmail);
    
    // Obtener información del usuario para remover de ambas colecciones
    const userInfo = await getUserUid(memberEmail);
    if (!userInfo) {
      throw new Error('Usuario no encontrado');
    }
    
    const batch = writeBatch(db);
    
    // 1. Remover de grupo web
    const webGroupRef = doc(db, 'circulos', groupId);
    batch.update(webGroupRef, {
      members: arrayRemove(memberEmail),
      membersUids: arrayRemove(userInfo.uid),
      lastSyncUpdate: new Date()
    });
    
    // 2. Obtener grupo móvil para remover miembro específico
    const mobileGroupDoc = await getDoc(doc(db, 'mobile_groups', groupId));
    if (mobileGroupDoc.exists()) {
      const mobileGroup = mobileGroupDoc.data();
      const updatedMembers = mobileGroup.members.filter((m: any) => m.email !== memberEmail);
      
      const mobileGroupRef = doc(db, 'mobile_groups', groupId);
      batch.update(mobileGroupRef, {
        members: updatedMembers,
        updatedAt: new Date()
      });
    }
    
    await batch.commit();
    console.log('✅ Miembro removido de ambas plataformas');
    
  } catch (error) {
    console.error('❌ Error removiendo miembro auto-sync:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Suscribirse a grupos con auto-sincronización
 */
export const subscribeToUserGroupsAutoSync = async (
  userEmail: string,
  callback: (groups: UnifiedGroup[]) => void
): Promise<() => void> => {
  console.log('🔄 Configurando suscripción auto-sync para:', userEmail);
  
  // Suscribirse a grupos web donde el usuario es miembro
  const unsubscribeWeb = onSnapshot(
    query(collection(db, 'circulos'), where('members', 'array-contains', userEmail)),
    (snapshot) => {
      const groups = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastSyncUpdate: data.lastSyncUpdate?.toDate() || null
        } as UnifiedGroup;
      });
      
      console.log('📊 Grupos auto-sync actualizados:', groups.length);
      callback(groups);
    },
    (error) => {
      console.error('❌ Error en suscripción auto-sync:', error);
      callback([]);
    }
  );
  
  return unsubscribeWeb;
};

/**
 * FUNCIÓN: Migrar grupos existentes a auto-sincronización
 */
export const migrateExistingGroupsToAutoSync = async (): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> => {
  try {
    console.log('🔄 Iniciando migración automática a auto-sync...');
    
    const groupsSnapshot = await getDocs(collection(db, 'circulos'));
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    for (const groupDoc of groupsSnapshot.docs) {
      processed++;
      
      try {
        const groupData = groupDoc.data();
        const groupId = groupDoc.id;
        
        // Verificar si ya tiene auto-sync
        if (groupData.isAutoSynced) {
          console.log('⏩ Grupo ya tiene auto-sync:', groupData.name);
          continue;
        }
        
        // Obtener UIDs de miembros
        const members = groupData.members || [];
        const membersWithUids = await getUserUids(members);
        
        const batch = writeBatch(db);
        
        // 1. Actualizar grupo web
        const webGroupRef = doc(db, 'circulos', groupId);
        batch.update(webGroupRef, {
          membersUids: membersWithUids.map(m => m.uid),
          isAutoSynced: true,
          lastSyncUpdate: new Date(),
          mobileGroupId: groupId
        });
        
        // 2. Crear/actualizar grupo móvil
        const mobileGroupData = {
          id: groupId,
          name: groupData.name,
          description: groupData.description || '',
          createdBy: groupData.createdBy,
          members: membersWithUids.map(m => ({
            uid: m.uid,
            email: m.email,
            name: m.name,
            role: m.email === groupData.createdBy ? 'admin' : 'member',
            joinedAt: new Date()
          })),
          pendingInvites: groupData.pendingInvitations || [],
          createdAt: groupData.createdAt || new Date(),
          updatedAt: new Date(),
          syncedFromWeb: true
        };
        
        const mobileGroupRef = doc(db, 'mobile_groups', groupId);
        batch.set(mobileGroupRef, mobileGroupData, { merge: true });
        
        await batch.commit();
        updated++;
        
        console.log('✅ Grupo migrado:', groupData.name);
        
      } catch (error) {
        console.error('❌ Error migrando grupo:', groupDoc.id, error);
        errors++;
      }
    }
    
    console.log('🎉 Migración completada:', { processed, updated, errors });
    return { processed, updated, errors };
    
  } catch (error) {
    console.error('❌ Error general en migración:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Verificar salud de sincronización
 */
export const checkAutoSyncHealth = async (userEmail: string): Promise<{
  totalGroups: number;
  syncedGroups: number;
  healthPercentage: number;
  needsUpdate: string[];
}> => {
  try {
    // Obtener grupos del usuario
    const userGroupsQuery = query(
      collection(db, 'circulos'), 
      where('members', 'array-contains', userEmail)
    );
    const groupsSnapshot = await getDocs(userGroupsQuery);
    
    let totalGroups = groupsSnapshot.size;
    let syncedGroups = 0;
    const needsUpdate: string[] = [];
    
    for (const groupDoc of groupsSnapshot.docs) {
      const data = groupDoc.data();
      
      if (data.isAutoSynced && data.membersUids?.length > 0) {
        syncedGroups++;
      } else {
        needsUpdate.push(groupDoc.id);
      }
    }
    
    const healthPercentage = totalGroups > 0 ? Math.round((syncedGroups / totalGroups) * 100) : 100;
    
    return {
      totalGroups,
      syncedGroups,
      healthPercentage,
      needsUpdate
    };
    
  } catch (error) {
    console.error('❌ Error verificando salud de sincronización:', error);
    return {
      totalGroups: 0,
      syncedGroups: 0,
      healthPercentage: 0,
      needsUpdate: []
    };
  }
};

// ======================== FUNCIONES AUXILIARES ========================

/**
 * Obtener UID de usuario por email
 */
const getUserUid = async (email: string): Promise<{
  uid: string;
  email: string;
  name: string;
} | null> => {
  try {
    const userQuery = query(collection(db, 'users'), where('email', '==', email));
    const userSnapshot = await getDocs(userQuery);
    
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      return {
        uid: userDoc.id,
        email: email,
        name: userData.name || email.split('@')[0]
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error obteniendo UID de usuario:', email, error);
    return null;
  }
};

/**
 * Obtener UIDs de múltiples usuarios
 */
const getUserUids = async (emails: string[]): Promise<Array<{
  uid: string;
  email: string;
  name: string;
}>> => {
  const results = [];
  
  for (const email of emails) {
    const userInfo = await getUserUid(email);
    if (userInfo) {
      results.push(userInfo);
    }
  }
  
  return results;
};

/**
 * LISTENER BIDIRECCIONAL: Escuchar cambios en móvil y replicar a web
 */
export const setupMobileToWebSync = (userEmail: string): () => void => {
  console.log('🔄 Configurando sincronización Móvil → Web');
  
  // Listener para cambios en grupos móviles
  const unsubscribe = onSnapshot(
    collection(db, 'mobile_groups'),
    async (snapshot) => {
      console.log('📱 Cambios detectados en grupos móviles');
      
      for (const change of snapshot.docChanges()) {
        if (change.type === 'modified') {
          try {
            const mobileGroup = change.doc.data();
            const groupId = change.doc.id;
            
            // Verificar si el usuario es miembro
            const isMember = mobileGroup.members.some((m: any) => m.email === userEmail);
            if (!isMember) continue;
            
            // Sincronizar cambios al grupo web
            const webGroupRef = doc(db, 'circulos', groupId);
            const webGroupDoc = await getDoc(webGroupRef);
            
            if (webGroupDoc.exists()) {
              await updateDoc(webGroupRef, {
                members: mobileGroup.members.map((m: any) => m.email),
                membersUids: mobileGroup.members.map((m: any) => m.uid),
                pendingInvitations: mobileGroup.pendingInvites || [],
                lastSyncUpdate: new Date()
              });
              
              console.log('✅ Grupo web sincronizado desde móvil:', groupId);
            }
            
          } catch (error) {
            console.error('❌ Error sincronizando móvil→web:', error);
          }
        }
      }
    }
  );
  
  return unsubscribe;
};

// EXPORTAR TODAS LAS FUNCIONES
export default {
  createAutoSyncGroup,
  addMemberAutoSync,
  removeMemberAutoSync,
  subscribeToUserGroupsAutoSync,
  migrateExistingGroupsToAutoSync,
  checkAutoSyncHealth,
  setupMobileToWebSync
};

/**
 * FUNCIÓN ADICIONAL: Forzar sincronización completa de un grupo
 */
export const forceSyncGroup = async (groupId: string): Promise<void> => {
  try {
    console.log('🔄 Forzando sincronización completa del grupo:', groupId);
    
    // 1. Obtener grupo web
    const webGroupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!webGroupDoc.exists()) {
      throw new Error('Grupo web no encontrado');
    }
    
    const webGroup = webGroupDoc.data();
    
    // 2. Obtener UIDs de miembros
    const membersWithUids = await getUserUids(webGroup.members || []);
    
    // 3. Crear/actualizar grupo móvil
    const mobileGroupData = {
      id: groupId,
      name: webGroup.name,
      description: webGroup.description || '',
      createdBy: webGroup.createdBy,
      members: membersWithUids.map(m => ({
        uid: m.uid,
        email: m.email,
        name: m.name,
        role: m.email === webGroup.createdBy ? 'admin' : 'member',
        joinedAt: new Date()
      })),
      pendingInvites: webGroup.pendingInvitations || [],
      createdAt: webGroup.createdAt || new Date(),
      updatedAt: new Date(),
      syncedFromWeb: true
    };
    
    // 4. Actualizar ambas colecciones
    const batch = writeBatch(db);
    
    // Actualizar web
    batch.update(doc(db, 'circulos', groupId), {
      membersUids: membersWithUids.map(m => m.uid),
      isAutoSynced: true,
      lastSyncUpdate: new Date(),
      mobileGroupId: groupId
    });
    
    // Crear/actualizar móvil
    batch.set(doc(db, 'mobile_groups', groupId), mobileGroupData, { merge: true });
    
    await batch.commit();
    
    console.log('✅ Sincronización forzada completada para grupo:', groupId);
    
  } catch (error) {
    console.error('❌ Error en sincronización forzada:', error);
    throw error;
  }
};
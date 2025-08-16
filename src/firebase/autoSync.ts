// src/firebase/autoSync.ts - ARREGLADO para estructura móvil existente
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

export interface UnifiedGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[]; // emails - para compatibilidad web
  membersUids?: string[]; // UIDs para móvil
  pendingInvitations: string[];
  createdAt: Date;
  isAutoSynced: boolean;
  lastSyncUpdate?: Date;
  
  // CAMPOS MÓVILES
  codigo?: string;
  nombre?: string;
  tipo?: string;
  creator?: string;
  miembros?: Array<{
    email: string;
    name: string;
    phone: string;
    uid: string;
    rol?: string;
  }>;
}

/**
 * FUNCIÓN: Crear grupo compatible
 */
export const createAutoSyncGroup = async (groupData: {
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  pendingInvitations: string[];
}): Promise<string> => {
  try {
    console.log('🚀 Creando grupo compatible:', groupData.name);
    
    // Obtener UIDs de los miembros
    const membersWithUids = await getUserUids(groupData.members);
    
    // Crear estructura compatible web/móvil
    const groupDoc = {
      // CAMPOS WEB
      name: groupData.name,
      description: groupData.description,
      createdBy: groupData.createdBy,
      members: groupData.members, // emails para web
      membersUids: membersWithUids.map(m => m.uid),
      pendingInvitations: groupData.pendingInvitations,
      isAutoSynced: true,
      createdAt: new Date(),
      lastSyncUpdate: new Date(),
      
      // CAMPOS MÓVILES
      nombre: groupData.name,
      codigo: generateGroupCode(),
      tipo: 'familia',
      creator: membersWithUids.find(m => m.email === groupData.createdBy)?.uid || '',
      creadoEn: new Date(),
      miembros: membersWithUids.map(m => ({
        email: m.email,
        name: m.name,
        phone: '0000000000', // Por defecto
        uid: m.uid,
        rol: m.email === groupData.createdBy ? 'admin' : 'familiar'
      }))
    };
    
    const groupRef = doc(collection(db, 'circulos'));
    await setDoc(groupRef, groupDoc);
    
    console.log('✅ Grupo compatible creado:', groupRef.id);
    return groupRef.id;
    
  } catch (error) {
    console.error('❌ Error creando grupo compatible:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Agregar miembro compatible
 */
export const addMemberAutoSync = async (groupId: string, memberEmail: string): Promise<void> => {
  try {
    console.log('👥 Agregando miembro compatible:', memberEmail);
    
    const userInfo = await getUserUid(memberEmail);
    if (!userInfo) {
      throw new Error('El usuario no está registrado en el sistema');
    }
    
    const groupRef = doc(db, 'circulos', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grupo no encontrado');
    }
    
    const groupData = groupDoc.data();
    
    // Actualizar arrays web
    const updatedMembers = [...(groupData.members || []), memberEmail];
    const updatedUids = [...(groupData.membersUids || []), userInfo.uid];
    
    // Actualizar array móvil
    const newMobileMemeber = {
      email: memberEmail,
      name: userInfo.name,
      phone: '0000000000',
      uid: userInfo.uid,
      rol: 'familiar'
    };
    const updatedMiembros = [...(groupData.miembros || []), newMobileMemeber];
    
    await updateDoc(groupRef, {
      // WEB
      members: updatedMembers,
      membersUids: updatedUids,
      // MÓVIL
      miembros: updatedMiembros,
      lastSyncUpdate: new Date()
    });
    
    console.log('✅ Miembro agregado en formato compatible');
    
  } catch (error) {
    console.error('❌ Error agregando miembro compatible:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Remover miembro compatible
 */
export const removeMemberAutoSync = async (groupId: string, memberEmail: string): Promise<void> => {
  try {
    console.log('🗑️ Removiendo miembro compatible:', memberEmail);
    
    const userInfo = await getUserUid(memberEmail);
    if (!userInfo) {
      throw new Error('Usuario no encontrado');
    }
    
    const groupRef = doc(db, 'circulos', groupId);
    const groupDoc = await getDoc(groupRef);
    
    if (!groupDoc.exists()) {
      throw new Error('Grupo no encontrado');
    }
    
    const groupData = groupDoc.data();
    
    // Filtrar de arrays web
    const updatedMembers = (groupData.members || []).filter((email: string) => email !== memberEmail);
    const updatedUids = (groupData.membersUids || []).filter((uid: string) => uid !== userInfo.uid);
    
    // Filtrar de array móvil
    const updatedMiembros = (groupData.miembros || []).filter((m: any) => m.email !== memberEmail);
    
    await updateDoc(groupRef, {
      // WEB
      members: updatedMembers,
      membersUids: updatedUids,
      // MÓVIL
      miembros: updatedMiembros,
      lastSyncUpdate: new Date()
    });
    
    console.log('✅ Miembro removido en formato compatible');
    
  } catch (error) {
    console.error('❌ Error removiendo miembro compatible:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Suscribirse a grupos (busca por email en ambos formatos)
 */
export const subscribeToUserGroupsAutoSync = async (
  userEmail: string,
  callback: (groups: UnifiedGroup[]) => void
): Promise<() => void> => {
  console.log('🔄 Buscando grupos para:', userEmail);
  
  // Obtener UID del usuario
  const userInfo = await getUserUid(userEmail);
  const userUid = userInfo?.uid;
  
  const unsubscribe = onSnapshot(
    collection(db, 'circulos'),
    (snapshot) => {
      const groups: UnifiedGroup[] = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        let isMember = false;
        
        // VERIFICAR SI ES MIEMBRO (formato web O móvil)
        if (data.members && data.members.includes(userEmail)) {
          isMember = true; // Formato web
        } else if (data.miembros && Array.isArray(data.miembros)) {
          // Formato móvil - buscar por email o UID
          isMember = data.miembros.some((m: any) => 
            m.email === userEmail || (userUid && m.uid === userUid)
          );
        }
        
        if (isMember) {
          // CONVERTIR A FORMATO UNIFICADO
          const unifiedGroup: UnifiedGroup = {
            id: doc.id,
            // Usar campos web si existen, sino móviles
            name: data.name || data.nombre || 'Grupo Sin Nombre',
            description: data.description || '',
            createdBy: data.createdBy || data.miembros?.find((m: any) => m.rol === 'admin')?.email || '',
            
            // CONVERTIR miembros móviles a formato web
            members: data.members || data.miembros?.map((m: any) => m.email) || [],
            membersUids: data.membersUids || data.miembros?.map((m: any) => m.uid) || [],
            
            pendingInvitations: data.pendingInvitations || [],
            createdAt: data.createdAt?.toDate() || data.creadoEn?.toDate() || new Date(),
            isAutoSynced: true, // Marcar como sincronizado
            lastSyncUpdate: data.lastSyncUpdate?.toDate() || null,
            
            // Campos móviles originales
            codigo: data.codigo,
            nombre: data.nombre,
            tipo: data.tipo,
            creator: data.creator,
            miembros: data.miembros
          };
          
          groups.push(unifiedGroup);
        }
      });
      
      console.log('📊 Grupos encontrados para', userEmail + ':', groups.length);
      callback(groups);
    },
    (error) => {
      console.error('❌ Error en suscripción:', error);
      callback([]);
    }
  );
  
  return unsubscribe;
};

/**
 * FUNCIÓN: Normalizar grupos existentes (convertir móvil → web+móvil)
 */
export const migrateExistingGroupsToAutoSync = async (): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> => {
  try {
    console.log('🔄 Normalizando grupos existentes...');
    
    const groupsSnapshot = await getDocs(collection(db, 'circulos'));
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    for (const groupDoc of groupsSnapshot.docs) {
      processed++;
      
      try {
        const data = groupDoc.data();
        const groupId = groupDoc.id;
        let needsUpdate = false;
        const updates: any = {};
        
        console.log('🔍 Procesando grupo:', data.name || data.nombre);
        
        // Si es formato móvil puro, agregar campos web
        if (data.miembros && !data.members) {
          console.log('📱 Convirtiendo grupo móvil a formato web+móvil');
          
          updates.members = data.miembros.map((m: any) => m.email);
          updates.membersUids = data.miembros.map((m: any) => m.uid);
          updates.name = data.nombre;
          updates.createdBy = data.miembros.find((m: any) => m.rol === 'admin')?.email || data.miembros[0]?.email;
          updates.pendingInvitations = [];
          updates.isAutoSynced = true;
          updates.lastSyncUpdate = new Date();
          
          needsUpdate = true;
        }
        // Si es formato web puro, agregar campos móviles
        else if (data.members && !data.miembros) {
          console.log('🌐 Convirtiendo grupo web a formato web+móvil');
          
          // Obtener info completa de usuarios
          const membersInfo = await getUserUids(data.members);
          
          updates.miembros = membersInfo.map(m => ({
            email: m.email,
            name: m.name,
            phone: '0000000000',
            uid: m.uid,
            rol: m.email === data.createdBy ? 'admin' : 'familiar'
          }));
          updates.nombre = data.name;
          updates.codigo = data.codigo || generateGroupCode();
          updates.tipo = 'familia';
          updates.creator = membersInfo.find(m => m.email === data.createdBy)?.uid || '';
          updates.creadoEn = data.createdAt || new Date();
          updates.membersUids = membersInfo.map(m => m.uid);
          updates.isAutoSynced = true;
          updates.lastSyncUpdate = new Date();
          
          needsUpdate = true;
        }
        
        // Aplicar actualizaciones si es necesario
        if (needsUpdate) {
          await updateDoc(doc(db, 'circulos', groupId), updates);
          updated++;
          console.log('✅ Grupo normalizado:', data.name || data.nombre);
        } else {
          console.log('⏩ Grupo ya está normalizado');
        }
        
      } catch (error) {
        console.error('❌ Error procesando grupo:', groupDoc.id, error);
        errors++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🎉 Normalización completada:', { processed, updated, errors });
    return { processed, updated, errors };
    
  } catch (error) {
    console.error('❌ Error en normalización:', error);
    throw error;
  }
};

/**
 * FUNCIÓN: Verificar salud (no mostrar UI)
 */
export const checkAutoSyncHealth = async (userEmail: string): Promise<{
  totalGroups: number;
  syncedGroups: number;
  healthPercentage: number;
  needsUpdate: string[];
}> => {
  try {
    const userInfo = await getUserUid(userEmail);
    const userUid = userInfo?.uid;
    
    const groupsSnapshot = await getDocs(collection(db, 'circulos'));
    let totalGroups = 0;
    let syncedGroups = 0;
    const needsUpdate: string[] = [];
    
    for (const groupDoc of groupsSnapshot.docs) {
      const data = groupDoc.data();
      let isMember = false;
      
      // Verificar si es miembro
      if (data.members && data.members.includes(userEmail)) {
        isMember = true;
      } else if (data.miembros && Array.isArray(data.miembros)) {
        isMember = data.miembros.some((m: any) => 
          m.email === userEmail || (userUid && m.uid === userUid)
        );
      }
      
      if (isMember) {
        totalGroups++;
        
        // Verificar si está normalizado (tiene ambos formatos)
        if (data.members && data.miembros) {
          syncedGroups++;
        } else {
          needsUpdate.push(groupDoc.id);
        }
      }
    }
    
    const healthPercentage = totalGroups > 0 ? Math.round((syncedGroups / totalGroups) * 100) : 100;
    
    return { totalGroups, syncedGroups, healthPercentage, needsUpdate };
    
  } catch (error) {
    console.error('❌ Error verificando salud:', error);
    return { totalGroups: 0, syncedGroups: 0, healthPercentage: 0, needsUpdate: [] };
  }
};

/**
 * FUNCIÓN: Forzar sincronización
 */
export const forceSyncGroup = async (groupId: string): Promise<void> => {
  try {
    console.log('🔄 Normalizando grupo específico:', groupId);
    
    const groupDoc = await getDoc(doc(db, 'circulos', groupId));
    if (!groupDoc.exists()) {
      throw new Error('Grupo no encontrado');
    }
    
    // Ejecutar normalización para este grupo específico
    await migrateExistingGroupsToAutoSync();
    
    console.log('✅ Grupo normalizado');
    
  } catch (error) {
    console.error('❌ Error normalizando grupo:', error);
    throw error;
  }
};

/**
 * Función dummy para compatibilidad
 */
export const setupMobileToWebSync = (userEmail: string): () => void => {
  return () => {};
};

// ======================== FUNCIONES AUXILIARES ========================

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
    console.error('❌ Error obteniendo UID:', email, error);
    return null;
  }
};

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
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return results;
};

const generateGroupCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default {
  createAutoSyncGroup,
  addMemberAutoSync,
  removeMemberAutoSync,
  subscribeToUserGroupsAutoSync,
  migrateExistingGroupsToAutoSync,
  checkAutoSyncHealth,
  forceSyncGroup,
  setupMobileToWebSync
};
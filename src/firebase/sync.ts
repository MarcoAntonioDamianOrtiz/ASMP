// firebase/sync.ts - Sistema de sincronización bidireccional Web-Móvil
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
  getDocs
} from "firebase/firestore";
import { db } from "./index";

// Interfaces para compatibilidad móvil-web
export interface MobileGroup {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: Array<{
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'member';
    joinedAt: Date;
  }>;
  pendingInvites: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WebGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  pendingInvitations: string[];
  createdAt?: Date;
}

export interface SyncMapping {
  webGroupId: string;
  mobileGroupId: string;
  lastSync: Date;
  conflictResolution: 'web_priority' | 'mobile_priority' | 'manual';
}

/**
 * Sincroniza un grupo de la web a móvil
 */
export const syncWebToMobile = async (webGroupId: string): Promise<string> => {
  try {
    // Obtener grupo de la web
    const webGroupDoc = await getDoc(doc(db, 'circulos', webGroupId));
    if (!webGroupDoc.exists()) {
      throw new Error('Grupo web no encontrado');
    }

    const webGroup = webGroupDoc.data() as WebGroup;
    
    // Obtener información detallada de usuarios
    const membersDetails = await Promise.all(
      webGroup.members.map(async (email) => {
        const userQuery = query(collection(db, 'users'), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          return {
            uid: userSnapshot.docs[0].id,
            email: email,
            name: userData.name || email.split('@')[0],
            role: email === webGroup.createdBy ? 'admin' as const : 'member' as const,
            joinedAt: new Date()
          };
        }
        
        return {
          uid: `temp_${Date.now()}`,
          email: email,
          name: email.split('@')[0],
          role: email === webGroup.createdBy ? 'admin' as const : 'member' as const,
          joinedAt: new Date()
        };
      })
    );

    // Crear grupo móvil
    const mobileGroup: Omit<MobileGroup, 'id'> = {
      name: webGroup.name,
      description: webGroup.description || '',
      createdBy: webGroup.createdBy,
      members: membersDetails,
      pendingInvites: webGroup.pendingInvitations || [],
      createdAt: webGroup.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Guardar en colección móvil
    const mobileGroupRef = doc(collection(db, 'mobile_groups'));
    await setDoc(mobileGroupRef, mobileGroup);

    // Crear mapeo de sincronización
    const syncMapping: SyncMapping = {
      webGroupId: webGroupId,
      mobileGroupId: mobileGroupRef.id,
      lastSync: new Date(),
      conflictResolution: 'web_priority'
    };

    await setDoc(doc(db, 'sync_mappings', `${webGroupId}_${mobileGroupRef.id}`), syncMapping);

    console.log('✅ Grupo sincronizado de Web a Móvil:', mobileGroupRef.id);
    return mobileGroupRef.id;

  } catch (error) {
    console.error('❌ Error sincronizando Web -> Móvil:', error);
    throw error;
  }
};

/**
 * Sincroniza un grupo de móvil a web
 */
export const syncMobileToWeb = async (mobileGroupId: string): Promise<string> => {
  try {
    // Obtener grupo móvil
    const mobileGroupDoc = await getDoc(doc(db, 'mobile_groups', mobileGroupId));
    if (!mobileGroupDoc.exists()) {
      throw new Error('Grupo móvil no encontrado');
    }

    const mobileGroup = mobileGroupDoc.data() as MobileGroup;

    // Convertir a formato web
    const webGroup: Omit<WebGroup, 'id'> = {
      name: mobileGroup.name,
      description: mobileGroup.description || '',
      createdBy: mobileGroup.createdBy,
      members: mobileGroup.members.map(member => member.email),
      pendingInvitations: mobileGroup.pendingInvites || [],
      createdAt: mobileGroup.createdAt
    };

    // Guardar en colección web
    const webGroupRef = doc(collection(db, 'circulos'));
    await setDoc(webGroupRef, webGroup);

    // Crear mapeo de sincronización
    const syncMapping: SyncMapping = {
      webGroupId: webGroupRef.id,
      mobileGroupId: mobileGroupId,
      lastSync: new Date(),
      conflictResolution: 'mobile_priority'
    };

    await setDoc(doc(db, 'sync_mappings', `${webGroupRef.id}_${mobileGroupId}`), syncMapping);

    console.log('✅ Grupo sincronizado de Móvil a Web:', webGroupRef.id);
    return webGroupRef.id;

  } catch (error) {
    console.error('❌ Error sincronizando Móvil -> Web:', error);
    throw error;
  }
};

/**
 * Obtiene todos los grupos disponibles (web + móvil) para un usuario
 */
export const getUserAllGroups = async (userEmail: string): Promise<{
  webGroups: WebGroup[];
  mobileGroups: MobileGroup[];
  syncedGroups: Array<{web: WebGroup, mobile: MobileGroup, mapping: SyncMapping}>;
}> => {
  try {
    // Grupos web
    const webQuery = query(collection(db, 'circulos'), where('members', 'array-contains', userEmail));
    const webSnapshot = await getDocs(webQuery);
    const webGroups = webSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as WebGroup));

    // Grupos móviles
    const mobileQuery = query(
      collection(db, 'mobile_groups'), 
      where('members', 'array-contains-any', 
        webGroups.map(g => ({ email: userEmail }))
      )
    );
    const mobileSnapshot = await getDocs(mobileQuery);
    const mobileGroups = mobileSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as MobileGroup));

    // Obtener mapeos de sincronización
    const syncSnapshot = await getDocs(collection(db, 'sync_mappings'));
    const syncMappings = syncSnapshot.docs.map(doc => doc.data() as SyncMapping);

    // Encontrar grupos sincronizados
    const syncedGroups = [];
    for (const mapping of syncMappings) {
      const webGroup = webGroups.find(g => g.id === mapping.webGroupId);
      const mobileGroup = mobileGroups.find(g => g.id === mapping.mobileGroupId);
      
      if (webGroup && mobileGroup) {
        syncedGroups.push({ web: webGroup, mobile: mobileGroup, mapping });
      }
    }

    return { webGroups, mobileGroups, syncedGroups };

  } catch (error) {
    console.error('❌ Error obteniendo todos los grupos:', error);
    return { webGroups: [], mobileGroups: [], syncedGroups: [] };
  }
};

/**
 * Listener para sincronización automática bidireccional
 */
export const setupBidirectionalSync = (userEmail: string, 
  onGroupsUpdate: (groups: {
    webGroups: WebGroup[];
    mobileGroups: MobileGroup[];
    syncedGroups: Array<{web: WebGroup, mobile: MobileGroup, mapping: SyncMapping}>;
  }) => void
) => {
  console.log('🔄 Configurando sincronización bidireccional para:', userEmail);

  // Listener para grupos web
  const unsubscribeWeb = onSnapshot(
    query(collection(db, 'circulos'), where('members', 'array-contains', userEmail)),
    async (webSnapshot) => {
      console.log('🌐 Cambios detectados en grupos web');
      
      // Sincronizar cambios a móvil
      for (const change of webSnapshot.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          try {
            // Verificar si ya existe mapeo
            const existingMapping = await checkSyncMapping(change.doc.id, 'web');
            if (!existingMapping) {
              await syncWebToMobile(change.doc.id);
            } else {
              await updateMobileFromWeb(change.doc.id, existingMapping.mobileGroupId);
            }
          } catch (error) {
            console.error('Error auto-sincronizando web->móvil:', error);
          }
        }
      }

      // Actualizar vista
      const allGroups = await getUserAllGroups(userEmail);
      onGroupsUpdate(allGroups);
    }
  );

  // Listener para grupos móviles
  const unsubscribeMobile = onSnapshot(
    collection(db, 'mobile_groups'),
    async (mobileSnapshot) => {
      console.log('📱 Cambios detectados en grupos móviles');
      
      // Filtrar solo grupos relevantes para el usuario
      const relevantChanges = mobileSnapshot.docChanges().filter(change => {
        const data = change.doc.data() as MobileGroup;
        return data.members.some(member => member.email === userEmail);
      });

      // Sincronizar cambios a web
      for (const change of relevantChanges) {
        if (change.type === 'added' || change.type === 'modified') {
          try {
            const existingMapping = await checkSyncMapping(change.doc.id, 'mobile');
            if (!existingMapping) {
              await syncMobileToWeb(change.doc.id);
            } else {
              await updateWebFromMobile(existingMapping.webGroupId, change.doc.id);
            }
          } catch (error) {
            console.error('Error auto-sincronizando móvil->web:', error);
          }
        }
      }

      // Actualizar vista
      const allGroups = await getUserAllGroups(userEmail);
      onGroupsUpdate(allGroups);
    }
  );

  // Retornar función de limpieza
  return () => {
    console.log('🧹 Desactivando sincronización bidireccional');
    unsubscribeWeb();
    unsubscribeMobile();
  };
};

/**
 * Verifica si existe mapeo de sincronización
 */
const checkSyncMapping = async (groupId: string, platform: 'web' | 'mobile'): Promise<SyncMapping | null> => {
  try {
    const syncSnapshot = await getDocs(collection(db, 'sync_mappings'));
    
    for (const doc of syncSnapshot.docs) {
      const mapping = doc.data() as SyncMapping;
      if (platform === 'web' && mapping.webGroupId === groupId) {
        return mapping;
      }
      if (platform === 'mobile' && mapping.mobileGroupId === groupId) {
        return mapping;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error verificando mapeo:', error);
    return null;
  }
};

/**
 * Actualiza grupo móvil desde cambios web
 */
const updateMobileFromWeb = async (webGroupId: string, mobileGroupId: string): Promise<void> => {
  try {
    const webGroupDoc = await getDoc(doc(db, 'circulos', webGroupId));
    if (!webGroupDoc.exists()) return;

    const webGroup = webGroupDoc.data() as WebGroup;
    const mobileGroupRef = doc(db, 'mobile_groups', mobileGroupId);

    // Obtener información detallada de nuevos miembros
    const membersDetails = await Promise.all(
      webGroup.members.map(async (email) => {
        const userQuery = query(collection(db, 'users'), where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          return {
            uid: userSnapshot.docs[0].id,
            email: email,
            name: userData.name || email.split('@')[0],
            role: email === webGroup.createdBy ? 'admin' as const : 'member' as const,
            joinedAt: new Date()
          };
        }
        
        return null;
      })
    );

    await updateDoc(mobileGroupRef, {
      name: webGroup.name,
      description: webGroup.description || '',
      members: membersDetails.filter(Boolean),
      pendingInvites: webGroup.pendingInvitations || [],
      updatedAt: new Date()
    });

    console.log('✅ Grupo móvil actualizado desde web');
  } catch (error) {
    console.error('❌ Error actualizando móvil desde web:', error);
  }
};

/**
 * Actualiza grupo web desde cambios móviles
 */
const updateWebFromMobile = async (webGroupId: string, mobileGroupId: string): Promise<void> => {
  try {
    const mobileGroupDoc = await getDoc(doc(db, 'mobile_groups', mobileGroupId));
    if (!mobileGroupDoc.exists()) return;

    const mobileGroup = mobileGroupDoc.data() as MobileGroup;
    const webGroupRef = doc(db, 'circulos', webGroupId);

    await updateDoc(webGroupRef, {
      name: mobileGroup.name,
      description: mobileGroup.description || '',
      members: mobileGroup.members.map(member => member.email),
      pendingInvitations: mobileGroup.pendingInvites || []
    });

    console.log('✅ Grupo web actualizado desde móvil');
  } catch (error) {
    console.error('❌ Error actualizando web desde móvil:', error);
  }
};

/**
 * Función para migrar datos existentes
 */
export const migrateExistingData = async (): Promise<void> => {
  try {
    console.log('🔄 Iniciando migración de datos existentes...');

    // Obtener todos los grupos web
    const webSnapshot = await getDocs(collection(db, 'circulos'));
    
    for (const webDoc of webSnapshot.docs) {
      const webGroup = { id: webDoc.id, ...webDoc.data() } as WebGroup;
      
      // Verificar si ya existe mapeo
      const existingMapping = await checkSyncMapping(webGroup.id, 'web');
      if (!existingMapping) {
        console.log('📤 Migrando grupo:', webGroup.name);
        await syncWebToMobile(webGroup.id);
      }
    }

    console.log('✅ Migración completada');
  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  }
};

/**
 * Función de utilidad para resolver conflictos manualmente
 */
export const resolveConflict = async (
  webGroupId: string, 
  mobileGroupId: string, 
  resolution: 'web_wins' | 'mobile_wins' | 'merge'
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    if (resolution === 'web_wins') {
      await updateMobileFromWeb(webGroupId, mobileGroupId);
    } else if (resolution === 'mobile_wins') {
      await updateWebFromMobile(webGroupId, mobileGroupId);
    } else if (resolution === 'merge') {
      // Implementar lógica de merge personalizada
      await mergeGroups(webGroupId, mobileGroupId);
    }

    // Actualizar mapeo
    const mappingRef = doc(db, 'sync_mappings', `${webGroupId}_${mobileGroupId}`);
    batch.update(mappingRef, {
      lastSync: new Date(),
      conflictResolution: resolution === 'merge' ? 'manual' : 
                         resolution === 'web_wins' ? 'web_priority' : 'mobile_priority'
    });

    await batch.commit();
    console.log('✅ Conflicto resuelto:', resolution);
  } catch (error) {
    console.error('❌ Error resolviendo conflicto:', error);
    throw error;
  }
};

/**
 * Merge inteligente de grupos
 */
const mergeGroups = async (webGroupId: string, mobileGroupId: string): Promise<void> => {
  try {
    const [webDoc, mobileDoc] = await Promise.all([
      getDoc(doc(db, 'circulos', webGroupId)),
      getDoc(doc(db, 'mobile_groups', mobileGroupId))
    ]);

    if (!webDoc.exists() || !mobileDoc.exists()) return;

    const webGroup = webDoc.data() as WebGroup;
    const mobileGroup = mobileDoc.data() as MobileGroup;

    // Combinar miembros únicos
    const allEmails = new Set([
      ...webGroup.members,
      ...mobileGroup.members.map(m => m.email)
    ]);

    const allInvitations = new Set([
      ...(webGroup.pendingInvitations || []),
      ...(mobileGroup.pendingInvites || [])
    ]);

    // Actualizar ambos grupos con datos combinados
    const mergedMembers = Array.from(allEmails);
    const mergedInvitations = Array.from(allInvitations);

    await Promise.all([
      updateDoc(doc(db, 'circulos', webGroupId), {
        members: mergedMembers,
        pendingInvitations: mergedInvitations
      }),
      updateDoc(doc(db, 'mobile_groups', mobileGroupId), {
        pendingInvites: mergedInvitations,
        updatedAt: new Date()
      })
    ]);

    console.log('✅ Grupos combinados exitosamente');
  } catch (error) {
    console.error('❌ Error en merge:', error);
    throw error;
  }
};
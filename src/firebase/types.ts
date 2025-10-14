export interface FirebaseUser {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: 'guardian' | 'protegido';
    status: 'online' | 'offline';
    location?: string;
    coordinates?: [number, number];
    lastSeen?: Date;
    currentGroupId?: string;
}

export interface FirebaseGroup {
    id: string;
    name: string;
    description: string;
    createdBy: string;
    members: string[];
    pendingInvitations: string[];
    createdAt?: Date;
}

export interface FirebaseAlert {
    id: string;
    circleIds?: string[];
    userId: string;
    userEmail: string;
    userName: string;
    location: string;
    coordinates?: [number, number];
    timestamp: any;
    type: 'panic' | 'geofence' | 'manual';
    resolved: boolean;
    groupId?: string;
    message?: string;
    phone?: string;
    destinatarios?: string[];
    emisorId?: string;
}

export interface FirebaseUbicacion {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: any;
    isOnline: boolean;
}

export interface GroupInvitation {
    id: string;
    groupId: string;
    groupName: string;
    inviterEmail: string;
    inviterName: string;
    inviteeEmail: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: any;
    expiresAt: any;
}

export interface UnifiedGroup {
    id: string;
    name: string;
    description: string;
    createdBy: string;
    members: string[];
    membersUids?: string[];
    pendingInvitations: string[];
    createdAt: Date;
    isAutoSynced: boolean;
    lastSyncUpdate?: Date;
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
import {
    collection,
    getDocs,
    deleteDoc,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    writeBatch
} from "firebase/firestore";
import { db, writeBatch as wb } from "./config";

export const cleanupDuplicateUsers = async (): Promise<{
    duplicatesFound: number;
    duplicatesCleaned: number;
    errors: string[];
}> => {
    const errors: string[] = [];
    let duplicatesFound = 0;
    let duplicatesCleaned = 0;

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersByEmail = new Map<string, any[]>();

        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = data.email;

            if (!usersByEmail.has(email)) {
                usersByEmail.set(email, []);
            }

            usersByEmail.get(email)!.push({
                id: doc.id,
                data: data,
                createdAt: data.createdAt?.toDate() || new Date(0)
            });
        });

        for (const [email, users] of usersByEmail.entries()) {
            if (users.length > 1) {
                duplicatesFound++;

                try {
                    const sortedUsers = users.sort((a, b) =>
                        b.createdAt.getTime() - a.createdAt.getTime()
                    );

                    const keepUser = sortedUsers[0];
                    const deleteUsers = sortedUsers.slice(1);

                    for (const userToDelete of deleteUsers) {
                        const oldLocationDoc = await getDoc(doc(db, 'ubicaciones', userToDelete.id));

                        if (oldLocationDoc.exists()) {
                            const oldLocationData = oldLocationDoc.data();

                            await setDoc(doc(db, 'ubicaciones', keepUser.id), {
                                ...oldLocationData,
                                userId: keepUser.id,
                                userEmail: email,
                                userName: keepUser.data.name || email.split('@')[0],
                                lastUpdate: new Date(),
                                migratedFrom: userToDelete.id
                            }, { merge: true });

                            await deleteDoc(doc(db, 'ubicaciones', userToDelete.id));
                        }
                    }

                    const batch = writeBatch(db);
                    deleteUsers.forEach(user => {
                        batch.delete(doc(db, 'users', user.id));
                    });

                    await batch.commit();
                    duplicatesCleaned += deleteUsers.length;

                } catch (error) {
                    const errorMsg = `Error cleaning duplicates for ${email}: ${error}`;
                    console.error('Error:', errorMsg);
                    errors.push(errorMsg);
                }
            }
        }

        return { duplicatesFound, duplicatesCleaned, errors };

    } catch (error) {
        console.error('Error in cleanup:', error);
        return {
            duplicatesFound: 0,
            duplicatesCleaned: 0,
            errors: [error instanceof Error ? error.message : 'Error desconocido']
        };
    }
};

export const diagnoseLocationIssues = async (userEmail?: string): Promise<{
    totalUsers: number;
    usersWithLocations: number;
    usersWithValidCoords: number;
    duplicateUsers: string[];
    orphanedLocations: string[];
    issues: string[];
    suggestions: string[];
}> => {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const duplicateUsers: string[] = [];
    const orphanedLocations: string[] = [];

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnapshot.size;
        const locationsSnapshot = await getDocs(collection(db, 'ubicaciones'));

        const usersByEmail = new Map<string, string[]>();
        const userIds = new Set<string>();

        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = data.email;

            userIds.add(doc.id);

            if (!usersByEmail.has(email)) {
                usersByEmail.set(email, []);
            }
            usersByEmail.get(email)!.push(doc.id);
        });

        for (const [email, ids] of usersByEmail.entries()) {
            if (ids.length > 1) {
                duplicateUsers.push(email);
                issues.push(`Duplicate user: ${email} (${ids.length} copies)`);
            }
        }

        let usersWithLocations = 0;
        let usersWithValidCoords = 0;

        locationsSnapshot.docs.forEach(doc => {
            const locationId = doc.id;
            const locationData = doc.data();

            if (!userIds.has(locationId)) {
                orphanedLocations.push(locationId);
                issues.push(`Orphaned location: ${locationId} (${locationData.userEmail})`);
            } else {
                usersWithLocations++;

                if (locationData.lat && locationData.lng &&
                    !isNaN(locationData.lat) && !isNaN(locationData.lng) &&
                    locationData.lat !== 0 && locationData.lng !== 0) {
                    usersWithValidCoords++;
                }
            }
        });

        if (duplicateUsers.length > 0) {
            suggestions.push(`Run cleanupDuplicateUsers() to clean ${duplicateUsers.length} duplicates`);
        }

        if (orphanedLocations.length > 0) {
            suggestions.push(`Run cleanupOrphanedLocations() to clean ${orphanedLocations.length} orphaned locations`);
        }

        if (usersWithValidCoords < usersWithLocations) {
            suggestions.push(`${usersWithLocations - usersWithValidCoords} users need to update their coordinates`);
        }

        if (userEmail) {
            const userQuery = collection(db, 'users');
            const userSnapshot = await getDocs(userQuery);
            const userDocs = userSnapshot.docs.filter(u => u.data().email === userEmail);

            if (userDocs.length === 0) {
                issues.push(`User not found: ${userEmail}`);
            } else if (userDocs.length > 1) {
                issues.push(`Duplicate user: ${userEmail}`);
            } else {
                const userId = userDocs[0].id;
                const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));

                if (!locationDoc.exists()) {
                    issues.push(`User without location: ${userEmail}`);
                    suggestions.push(`Run activateMemberCircle('${userEmail}') to create location`);
                } else {
                    const locationData = locationDoc.data();
                    if (!locationData.lat || !locationData.lng || locationData.lat === 0 || locationData.lng === 0) {
                        issues.push(`User without valid coordinates: ${userEmail}`);
                        suggestions.push(`User must share location from app`);
                    }
                }
            }
        }

        return {
            totalUsers,
            usersWithLocations,
            usersWithValidCoords,
            duplicateUsers,
            orphanedLocations,
            issues,
            suggestions
        };

    } catch (error) {
        console.error('Error in diagnosis:', error);
        return {
            totalUsers: 0,
            usersWithLocations: 0,
            usersWithValidCoords: 0,
            duplicateUsers: [],
            orphanedLocations: [],
            issues: ['Error running diagnosis'],
            suggestions: ['Check logs for details']
        };
    }
};

export const autoFixLocationIssues = async (): Promise<{
    duplicatesCleaned: number;
    orphansCleaned: number;
    usersFixed: number;
    errors: string[];
}> => {
    const errors: string[] = [];
    let duplicatesCleaned = 0;
    let orphansCleaned = 0;
    let usersFixed = 0;

    try {
        const duplicateResult = await cleanupDuplicateUsers();
        duplicatesCleaned = duplicateResult.duplicatesCleaned;
        errors.push(...duplicateResult.errors);

        const usersSnapshot = await getDocs(collection(db, 'users'));

        for (const userDoc of usersSnapshot.docs) {
            try {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const locationDoc = await getDoc(doc(db, 'ubicaciones', userId));

                if (!locationDoc.exists()) {
                    await setDoc(doc(db, 'ubicaciones', userId), {
                        userId: userId,
                        userEmail: userData.email,
                        userName: userData.name || userData.email.split('@')[0],
                        isOnline: false,
                        lastActivated: new Date(),
                    });

                    usersFixed++;
                }
            } catch (error) {
                const errorMsg = `Error creating location for user ${userDoc.id}: ${error}`;
                console.error('Error:', errorMsg);
                errors.push(errorMsg);
            }
        }

        return { duplicatesCleaned, orphansCleaned, usersFixed, errors };

    } catch (error) {
        console.error('Error in auto fix:', error);
        return {
            duplicatesCleaned: 0,
            orphansCleaned: 0,
            usersFixed: 0,
            errors: [error instanceof Error ? error.message : 'Error desconocido']
        };
    }
};
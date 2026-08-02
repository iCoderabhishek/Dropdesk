import { redis } from "./redis";

export const CacheKeys = {
    workspaceFolders: (workspaceId: string, parentId?: string) => 
        parentId ? `ws:${workspaceId}:folders:parent:${parentId}` : `ws:${workspaceId}:folders:all`,
    workspaceFoldersPattern: (workspaceId: string) => `ws:${workspaceId}:folders*`,
    
    workspaceFiles: (workspaceId: string) => `ws:${workspaceId}:files`,
    workspaceTrashed: (workspaceId: string) => `ws:${workspaceId}:trashed`,
    
    userWorkspaces: (userId: string) => `ws:${userId}`,
};

export const CacheService = {
    async get<T>(key: string): Promise<T | null> {
        const data = await redis.get(key);
        return data ? (JSON.parse(data) as T) : null;
    },

    async set(key: string, data: any, ttlInSeconds: number = 60): Promise<void> {
        await redis.set(key, JSON.stringify(data), "EX", ttlInSeconds);
    },

    async del(key: string): Promise<void> {
        await redis.del(key);
    },

    async delByPattern(pattern: string): Promise<void> {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    },

    // Domain specific helpers
    async clearWorkspaceFolders(workspaceId: string): Promise<void> {
        await this.delByPattern(CacheKeys.workspaceFoldersPattern(workspaceId));
    },

    async clearWorkspaceFiles(workspaceId: string): Promise<void> {
        await this.del(CacheKeys.workspaceFiles(workspaceId));
    },

    async clearWorkspaceTrashed(workspaceId: string): Promise<void> {
        await this.del(CacheKeys.workspaceTrashed(workspaceId));
    },

    async clearUserWorkspaces(userId: string): Promise<void> {
        await this.del(CacheKeys.userWorkspaces(userId));
    }
};

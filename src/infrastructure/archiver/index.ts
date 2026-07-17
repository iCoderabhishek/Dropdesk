import { ZipArchive } from "archiver";

export const createArchiver = () => {
    return new ZipArchive({
        zlib: { level: 5 }
    });
};

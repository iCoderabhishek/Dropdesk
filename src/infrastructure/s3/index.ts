import { S3Client } from "@aws-sdk/client-s3"
import { S3_BUCKET, S3_REGION } from "../../config/env"

export const s3 = new S3Client({
    region: S3_REGION,
    requestChecksumCalculation: "WHEN_REQUIRED",
})
export const BUCKET = S3_BUCKET
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import pathNode from "path";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_KEY_PREFIX = "book-covers/";

export function isS3Key(key) {
  return key && typeof key === "string" && key.startsWith(S3_KEY_PREFIX);
}

export async function uploadFileToS3(fileBuffer, originalname, mimetype) {
  if (!BUCKET_NAME || !process.env.AWS_REGION) {
    throw new Error("S3 bucket name or region not configured.");
  }
  const fileExtension = pathNode.extname(originalname);
  const fileName = `coverImage-${Date.now()}${fileExtension}`;
  const s3Key = `${S3_KEY_PREFIX}${fileName}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);
  return s3Key;
}

export async function deleteFileFromS3(s3Key) {
  if (!BUCKET_NAME || !isS3Key(s3Key)) {
    console.warn(
      `[S3 Service] Invalid S3 key or bucket not configured for deletion: ${s3Key}`,
    );
    return;
  }
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
  };
  const command = new DeleteObjectCommand(params);
  await s3Client.send(command);
  console.log(`[S3 Service] Deleted ${s3Key} from S3.`);
}

export async function getPublicS3Url(s3Key) {
  if (!BUCKET_NAME || !process.env.AWS_REGION || !isS3Key(s3Key)) return null;
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

export async function getSignedUrlForS3ObjectGet(s3Key, expiresIn = 3600) {
  if (!BUCKET_NAME || !process.env.AWS_REGION || !isS3Key(s3Key)) {
    console.warn(
      `[S3 Service] Cannot generate signed GET URL for invalid S3 key or bucket not configured: ${s3Key}`,
    );
    return null;
  }
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
  };
  const command = new GetObjectCommand(params);
  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error(
      `[S3 Service] Error generating signed GET URL for ${s3Key}:`,
      error,
    );
    return null;
  }
}

export async function generatePresignedPutUrl(filename, contentType) {
  if (!BUCKET_NAME || !process.env.AWS_REGION) {
    throw new Error(
      "S3 bucket name or region not configured for pre-signed PUT URL.",
    );
  }
  const fileExtension = pathNode.extname(filename);
  const uniqueFileName = `coverImage-${Date.now()}${fileExtension}`;
  const s3Key = `${S3_KEY_PREFIX}${uniqueFileName}`;

  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
  };
  const command = new PutObjectCommand(params);
  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    return { signedUrl, s3Key };
  } catch (error) {
    console.error("[S3 Service] Error generating pre-signed PUT URL:", error);
    throw error;
  }
}

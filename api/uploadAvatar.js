import { s3Client, bucketName, publicUrl } from './_lib/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { applyCors, json } from './_lib/http.js';
import { db, auth } from './_lib/firebaseAdmin.js';

export default async function handler(req, res) {
    if (applyCors(req, res, { methods: ['POST', 'OPTIONS'] })) return;

    if (req.method !== 'POST') {
        return json(res, 405, { error: 'Method not allowed' });
    }

    try {
        const idToken = (req.headers.authorization || '').replace('Bearer ', '');
        if (!idToken) return json(res, 401, { error: 'No autenticado.' });

        let decoded;
        try {
            decoded = await auth.verifyIdToken(idToken);
        } catch {
            return json(res, 401, { error: 'Token inválido.' });
        }

        const { uid, imageData } = req.body;
        if (!uid || !imageData) {
            return json(res, 400, { error: 'Missing uid or imageData' });
        }

        if (decoded.uid !== uid) {
            return json(res, 403, { error: 'No autorizado para esta cuenta.' });
        }


        const match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!match) return json(res, 400, { error: 'Invalid image format.' });
        
        const imageBuffer = Buffer.from(match[2], 'base64');
        if (imageBuffer.length > 5 * 1024 * 1024) {
            return json(res, 400, { error: 'Image size exceeds 5MB limit.' });
        }

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const fileName = `avatars/${uid}/avatar.${ext}`;
        
        if (!s3Client) {
            return json(res, 500, { error: 'R2 Storage not configured.' });
        }

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: imageBuffer,
            ContentType: `image/${match[1]}`
        });
        await s3Client.send(command);

        const avatarUrl = `${publicUrl}/${fileName}`;
        
        // Update user profile in Firestore
        await db.collection('users').doc(uid).update({
            photoURL: avatarUrl,
            updatedAt: new Date().toISOString()
        });

        return json(res, 200, { success: true, url: avatarUrl });

    } catch (error) {
        console.error("Error uploading avatar to R2:", error);
        return json(res, 500, { error: 'Internal Server Error' });
    }
}

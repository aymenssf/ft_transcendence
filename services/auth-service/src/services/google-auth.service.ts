import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID, 
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
);

export async function verifyGoogleToken(token : string)
{
    try { 
        const ticket = await client.verifyIdToken({
            idToken : token, 
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
    if (!payload) 
      throw new Error('Invalid token payload');

    return {
        googleId: payload.sub,
        email: payload.email, 
        name: payload.name, 
        avatar: payload.picture,
        emailVerified: payload.email_verified
    };

    }
    catch(error){
        throw new Error('Invalid google token ');
    }

}

export function getGoogleAuthUrl()
{
    const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
    ];

    return client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    })

}

export async function getGoogleUserFromCode(code: string)
{
    try
    {
        const {tokens } = await client.getToken(code);
        
        if(!tokens.id_token)
            throw new Error('NO id token received');
    
        return await verifyGoogleToken(tokens.id_token);

    }
    catch (error) 
    {
        throw new Error('Failed to get user from Google');
}
}

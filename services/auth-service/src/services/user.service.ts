import { prisma } from '@ft/shared-database';

interface GoogleUserData{
    googleId: string,
    email: string,
    name: string,
    avatar?: string;
}


export async function findOrCreateGoogleUser(googledata: GoogleUserData )
{
    let user = await prisma.user.findUnique({
        where: { googleId: googledata.googleId }
    });

    if(user)
        return user;

    user = await prisma.user.findUnique({
        where: {email: googledata.email}, 
    });

    if(user)
    {
        user = await prisma.user.update({
        where: { email: googledata.email },
      data: {
        googleId: googledata.googleId,
        provider: 'google',
        avatar: googledata.avatar || user.avatar
      } 
        });
    
        return user;
    }

  const baseUsername = googledata.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')  
    .replace(/_+/g, '_')          
    .slice(0, 20);                
  
  let username = baseUsername;
  let counter = 1;
  
  while (await prisma.user.findUnique({ where: { username } })) 
    {
    username = `${baseUsername}_${counter}`;
    counter++;
  }

  user = await prisma.user.create({
    data: {
      email: googledata.email,
      username: username,
      googleId: googledata.googleId,
      provider: 'google',
      avatar: googledata.avatar,
      password: null  
    }
  });
  
  return user;  
}

import { prisma } from '@ft/shared-database';
import bcrypt from 'bcrypt';
import { User42Profile } from './42-auth.service.js';

export interface CreateUserData {
  username: string;
  email: string;
  password?: string;
  avatar?: string;
  provider?: string;
  is_42_user?: boolean;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  avatar?: string;
  password?: string;
  status?: string;
  lastSeen?: Date;
}

export class UserService {
  private prisma = prisma;

  constructor() {
  }

  async findById(id: number): Promise<any> {
    try 
    {
      return await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          is_42_user: true,
          provider: true,
          status: true,
          created_at: true,
          lastSeen: true
        }
      });
    } 
    catch (error) {
      console.error('Error finding user by ID:', error);
      throw new Error('Failed to find user');
    }
  }

  async findByEmail(email: string): Promise<any> {
    try 
    {
      return await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          is_42_user: true,
          provider: true,
          status: true,
          created_at: true,
          lastSeen: true
        }
      });
    } 
    catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error('Failed to find user');
    }
  }

  async findByUsername(username: string): Promise<any> {
    try 
    {
      return await this.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          is_42_user: true,
          provider: true,
          status: true,
          created_at: true,
          lastSeen: true
        }
      });
    } 
    catch (error) {
      console.error('Error finding user by username:', error);
      throw new Error('Failed to find user');
    }
  }

  async createUser(userData: CreateUserData): Promise<any> {
    try 
    {
      let hashedPassword: string | undefined = undefined;
      if (userData.password) 
        hashedPassword = await bcrypt.hash(userData.password, 12);

      const id = await this.generateUniqueId();

      const user = await this.prisma.user.create({
        data: {
          id,
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          avatar: userData.avatar,
          provider: userData.provider || '42',
          is_42_user: userData.is_42_user || false,
          status: 'online',
          lastSeen: new Date()
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          is_42_user: true,
          provider: true,
          status: true,
          created_at: true,
          lastSeen: true
        }
      });

      return user;
    } 
    catch (error) {
      console.error('Error creating user:', error);
      if (error instanceof Error && error.message.includes('Unique constraint')) 
        throw new Error('User with this email or username already exists');
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: number, updateData: UpdateUserData): Promise<any> {
    try 
    {
      let hashedPassword: string | undefined = undefined;
      if (updateData.password) 
        hashedPassword = await bcrypt.hash(updateData.password, 12);

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          password: hashedPassword || undefined,
          lastSeen: new Date()
        },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          is_42_user: true,
          provider: true,
          status: true,
          created_at: true,
          lastSeen: true
        }
      });

      return user;
    } 
    catch (error) {
      console.error('Error updating user:', error);
      if (error instanceof Error && error.message.includes('Unique constraint')) 
        throw new Error('Username or email already exists');
      throw new Error('Failed to update user');
    }
  }

  async createOrUpdateFrom42Profile(profile: User42Profile): Promise<any> {
    try {
      const existingUser = await this.findByEmail(profile.email);

      if (existingUser) 
      {
        // Update existing user with 42 data
        const updatedUser = await this.updateUser(existingUser.id, {
          username: profile.login,
          avatar: profile.image?.versions?.medium || profile.image?.versions?.large,
          status: 'online'
        });
        
        if (!existingUser.is_42_user) 
        {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { 
              is_42_user: true,
              provider: '42'
            }
          });
        }

        return updatedUser;
      } 
      else 
      {
        // Create new user from 42 profile
        const userData: CreateUserData = {
          username: profile.login,
          email: profile.email,
          avatar: profile.image?.versions?.medium || profile.image?.versions?.large,
          provider: '42',
          is_42_user: true
        };

        return await this.createUser(userData);
      }
    } 
    catch (error) {
      console.error('Error creating/updating user from 42 profile:', error);
      
      if (error instanceof Error && error.message.includes('username already exists')) 
      {
        const modifiedUsername = `${profile.login}_42_${Date.now()}`;
        
        const userData: CreateUserData = 
        {
          username: modifiedUsername,
          email: profile.email,
          avatar: profile.image?.versions?.medium || profile.image?.versions?.large,
          provider: '42',
          is_42_user: true
        };

        return await this.createUser(userData);
      }
      
      throw error;
    }
  }

  async verifyPassword(userId: number, password: string): Promise<boolean> {
    try 
    {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (!user || !user.password) 
        return false;

      return await bcrypt.compare(password, user.password);
    } 
    catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  async updateUserStatus(id: number, status: 'online' | 'offline' | 'in-game'): Promise<void> {
    try 
    {
      await this.prisma.user.update({
        where: { id },
        data: { 
          status,
          lastSeen: new Date()
        }
      });
    } 
    catch (error) {
      console.error('Error updating user status:', error);
      throw new Error('Failed to update user status');
    }
  }

  private async generateUniqueId(): Promise<number> {
    let id: number;
    let existingUser: any;

    do 
    {
      id = Math.floor(Math.random() * 2147483647) + 1; 
      try 
      {
        existingUser = await this.prisma.user.findUnique({
          where: { id },
          select: { id: true }
        });
      } 
      catch (error) {
        existingUser = null;
      }
    } while (existingUser);

    return id;
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    try 
    {
      const user = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true }
      });
      return !user;
    } 
    catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    try 
    {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true }
      });
      return !user;
    } 
    catch (error) {
      console.error('Error checking email availability:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export const userService = new UserService();

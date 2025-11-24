export interface User {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
  status?: 'online' | 'offline';
  created_at?: string;
}

export interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender?: User;
  receiver?: User;
}

export interface GameInvite {
  id: number;
  senderId: number;
  receiverId: number;
  gameType: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  sender?: User;
}

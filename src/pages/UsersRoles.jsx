import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Shield,
  User,
  Eye,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function UsersRoles() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteWblRole, setInviteWblRole] = useState('researcher');
  const [inviting, setInviting] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editWblRole, setEditWblRole] = useState('researcher');
  const [saving, setSaving] = useState(false);

  // Add user dialog
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserEmail, setAddUserEmail] = useState('');
  const [addUserPassword, setAddUserPassword] = useState('');
  const [addUserConfirmPassword, setAddUserConfirmPassword] = useState('');
  const [addUserRole, setAddUserRole] = useState('user');
  const [addUserWblRole, setAddUserWblRole] = useState('researcher');
  const [addUserFullName, setAddUserFullName] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const usersData = await base44.entities.User.list();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || 
      u.role === roleFilter || 
      u.wbl_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }

    setInviting(true);
    try {
      const result = await base44.functions.invoke('adminInviteUser', { 
        email: inviteEmail, 
        role: inviteRole, 
        wbl_role: inviteWblRole 
      });
      
      if (result.data.error) {
        toast.error(result.data.error);
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteDialogOpen(false);
        setInviteEmail('');
        loadData();
      }
    } catch (error) {
      console.error('Failed to invite:', error);
      const errorMessage = error.response?.data?.error || error.message || error.data?.error || 'Failed to send invitation';
      toast.error(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setEditWblRole(user.wbl_role || 'researcher');
    setEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const payload = editWblRole === 'sub_admin'
        ? { wbl_role: 'sub_admin', role: 'admin' }
        : { wbl_role: editWblRole };
      
      await base44.entities.User.update(editingUser.id, payload);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...payload } : u));
      toast.success('User role updated successfully');
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error('Failed to update user role');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!addUserEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    if (addUserPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (addUserPassword !== addUserConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setAddingUser(true);
    try {
      const result = await base44.functions.invoke('adminCreateUser', {
        email: addUserEmail,
        password: addUserPassword,
        role: addUserRole,
        wbl_role: addUserWblRole,
        full_name: addUserFullName || undefined
      });

      if (result.data.error) {
        toast.error(result.data.error);
      } else {
        if (result.data.mode === 'created') {
          toast.success('User created successfully');
        } else if (result.data.mode === 'invited') {
          toast.success('User invited successfully (password must be set via invitation email)');
        } else {
          toast.success('User processed successfully');
        }
        setAddUserDialogOpen(false);
        setAddUserEmail('');
        setAddUserPassword('');
        setAddUserConfirmPassword('');
        setAddUserFullName('');
        loadData();
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      const errorMessage = error.response?.data?.error || error.message || error.data?.error || 'Failed to create user';
      toast.error(errorMessage);
    } finally {
      setAddingUser(false);
    }
  };

  const getRoleBadge = (user) => {
    if (user.wbl_role === 'sub_admin') {
      return <Badge className="bg-indigo-100 text-indigo-700">Sub-Admin</Badge>;
    }
    if (user.role === 'admin') {
      return <Badge className="bg-purple-100 text-purple-700">Admin</Badge>;
    }
    switch (user.wbl_role) {
      case 'validator':
        return <Badge className="bg-blue-100 text-blue-700">Validator</Badge>;
      case 'viewer':
        return <Badge className="bg-slate-100 text-slate-700">Viewer</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-700">Researcher</Badge>;
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin' && u.wbl_role !== 'sub_admin').length,
    validators: users.filter(u => u.wbl_role === 'validator').length,
    researchers: users.filter(u => u.wbl_role !== 'validator' && u.wbl_role !== 'viewer' && u.wbl_role !== 'sub_admin' && u.role !== 'admin').length,
    viewers: users.filter(u => u.wbl_role === 'viewer').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Users & Roles</h1>
          <p className="text-slate-500 mt-1">Manage user access and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAddUserDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User Manually
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)} className="bg-[#002244] hover:bg-[#003366]">
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-slate-500">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold">{stats.admins}</p>
            <p className="text-sm text-slate-500">Admins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <User className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">{stats.researchers}</p>
            <p className="text-sm text-slate-500">Researchers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <User className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{stats.validators}</p>
            <p className="text-sm text-slate-500">Validators</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="h-6 w-6 mx-auto mb-2 text-slate-500" />
            <p className="text-2xl font-bold">{stats.viewers}</p>
            <p className="text-sm text-slate-500">Viewers</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="sub_admin">Sub-Admin</SelectItem>
                <SelectItem value="researcher">Researcher</SelectItem>
                <SelectItem value="validator">Validator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No users found</h3>
              <p className="text-slate-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-[#002244] text-white">
                            {user.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.full_name || 'Unknown'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user)}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEditRole(user)}
                        disabled={user.role === 'admin' && user.wbl_role !== 'sub_admin'}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join the WBL Analyst Workbench
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={inviteWblRole === 'sub_admin'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {inviteWblRole === 'sub_admin' && (
                <p className="text-xs text-amber-600">System role is automatically set to Admin for Sub-Admins</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>WBL Role</Label>
              <Select value={inviteWblRole} onValueChange={(val) => {
                setInviteWblRole(val);
                if (val === 'sub_admin') {
                  setInviteRole('admin');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="validator">Validator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="sub_admin">Sub-Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Researcher: Can create batches, edit tasks, run AI<br/>
                Validator: Can approve/return submitted tasks<br/>
                Viewer: Read-only access<br/>
                Sub-Admin: Full admin access to administration section
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User Manually</DialogTitle>
            <DialogDescription>
              Create a user account with a password (no email invitation)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={addUserEmail}
                onChange={(e) => setAddUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-fullname">Full Name</Label>
              <Input
                id="add-fullname"
                value={addUserFullName}
                onChange={(e) => setAddUserFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-password">Password *</Label>
              <Input
                id="add-password"
                type="password"
                value={addUserPassword}
                onChange={(e) => setAddUserPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-confirm">Confirm Password *</Label>
              <Input
                id="add-confirm"
                type="password"
                value={addUserConfirmPassword}
                onChange={(e) => setAddUserConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={addUserRole} onValueChange={setAddUserRole} disabled={addUserWblRole === 'sub_admin'}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {addUserWblRole === 'sub_admin' && (
                <p className="text-xs text-amber-600">System role is automatically set to Admin for Sub-Admins</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>WBL Role</Label>
              <Select value={addUserWblRole} onValueChange={(val) => {
                setAddUserWblRole(val);
                if (val === 'sub_admin') {
                  setAddUserRole('admin');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="validator">Validator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="sub_admin">Sub-Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={addingUser}>
              {addingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change WBL role for {editingUser?.full_name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>WBL Role</Label>
              <Select value={editWblRole} onValueChange={setEditWblRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="validator">Validator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="sub_admin">Sub-Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
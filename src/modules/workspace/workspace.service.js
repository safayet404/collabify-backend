const crypto = require('crypto');
const Workspace = require('./workspace.model');
const User = require('../auth/user.model');
const AppError = require('../../utils/AppError');
const { createActivity } = require('../activity/activity.service');
const { createNotification } = require('../notification/notification.service');
const { sendEmail, emailTemplates } = require('../../utils/email');
const { emitToWorkspace } = require('../../socket');

const createWorkspace = async (userId, { name, description, color }) => {
    const workspace = await Workspace.create({
        name,
        description,
        color: color || '#4F46E5',
        owner: userId,
        members: [{ user: userId, role: 'owner', joinedAt: new Date() }],
        memberCount: 1,
    });

    await createActivity({
        userId,
        workspaceId: workspace._id,
        action: 'workspace.created',
        description: `created workspace "${workspace.name}"`,
    });

    return workspace;
};

const getUserWorkspaces = async (userId) => {
    const workspaces = await Workspace.find({ 'members.user': userId })
        .populate('owner', 'name avatar email initials color')
        .populate('members.user', 'name avatar email initials color')
        .sort({ updatedAt: -1 })
        .lean();

    return workspaces.map(w => ({
        ...w,
        myRole: w.members.find(m => m.user._id.toString() === userId.toString())?.role,
    }));
};

const getWorkspace = async (workspaceId, userId) => {
    const workspace = await Workspace.findById(workspaceId)
        .populate('owner', 'name avatar email initials color')
        .populate('members.user', 'name avatar email initials color')
        .populate('invites.invitedBy', 'name avatar');

    if (!workspace) throw new AppError('Workspace not found', 404);
    if (!workspace.isMember(userId)) throw new AppError('You are not a member of this workspace', 403);

    return {
        ...workspace.toObject(),
        myRole: workspace.getMemberRole(userId),
    };
};

const updateWorkspace = async (workspaceId, userId, updates) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (!workspace.isOwnerOrAdmin(userId)) throw new AppError('Only owners and admins can update this workspace', 403);

    const allowed = ['name', 'description', 'color', 'logo'];
    allowed.forEach(field => { if (updates[field] !== undefined) workspace[field] = updates[field]; });
    await workspace.save();

    await createActivity({
        userId,
        workspaceId: workspace._id,
        action: 'workspace.updated',
        description: `updated workspace "${workspace.name}"`,
    });

    emitToWorkspace(workspaceId, 'workspace:updated', workspace);
    return workspace;
};

const deleteWorkspace = async (workspaceId, userId) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (workspace.owner.toString() !== userId.toString()) throw new AppError('Only the owner can delete this workspace', 403);

    const Board = require('../board/board.model');
    await Board.deleteMany({ workspace: workspaceId });

    await workspace.deleteOne();
};

const inviteMember = async (workspaceId, userId, { email, role }) => {
    const workspace = await Workspace.findById(workspaceId).populate('owner', 'name');
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (!workspace.isOwnerOrAdmin(userId)) throw new AppError('Only owners and admins can invite members', 403);

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser && workspace.isMember(existingUser._id)) {
        throw new AppError('User is already a member of this workspace', 400);
    }

    const existingInvite = workspace.invites.find(i => i.email === email && !i.accepted);
    if (existingInvite) throw new AppError('An invitation has already been sent to this email', 400);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    workspace.invites.push({ email, role: role || 'member', token, invitedBy: userId, expiresAt });
    await workspace.save();

    const inviter = await User.findById(userId);
    const inviteUrl = `${process.env.CLIENT_URL}/invite?token=${token}`;

    await sendEmail({
        to: email,
        ...emailTemplates.inviteToWorkspace({
            inviterName: inviter.name,
            workspaceName: workspace.name,
            inviteUrl,
        }),
    }).catch(console.error);

    if (existingUser) {
        await createNotification({
            recipientId: existingUser._id,
            senderId: userId,
            type: 'workspace.invited',
            title: `Invited to ${workspace.name}`,
            message: `${inviter.name} invited you to join "${workspace.name}"`,
            link: inviteUrl,
        });
    }

    return { message: `Invitation sent to ${email}` };
};

const acceptInvite = async (token, userId) => {
    const workspace = await Workspace.findOne({ 'invites.token': token });
    if (!workspace) throw new AppError('Invalid or expired invitation', 400);

    const invite = workspace.invites.find(i => i.token === token);
    if (!invite) throw new AppError('Invitation not found', 400);
    if (invite.accepted) throw new AppError('Invitation already accepted', 400);
    if (new Date() > invite.expiresAt) throw new AppError('Invitation has expired', 400);

    if (!workspace.isMember(userId)) {
        workspace.members.push({ user: userId, role: invite.role, joinedAt: new Date() });
        workspace.memberCount = workspace.members.length;
    }

    invite.accepted = true;
    await workspace.save();

    const user = await User.findById(userId);

    await createActivity({
        userId,
        workspaceId: workspace._id,
        action: 'workspace.member_added',
        description: `${user.name} joined the workspace`,
    });

    emitToWorkspace(workspace._id.toString(), 'workspace:member-joined', {
        user: { _id: user._id, name: user.name, avatar: user.avatar },
        role: invite.role,
    });

    return workspace;
};

const removeMember = async (workspaceId, userId, targetUserId) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);

    const isSelf = userId.toString() === targetUserId.toString();
    if (!isSelf && !workspace.isOwnerOrAdmin(userId)) {
        throw new AppError('You do not have permission to remove members', 403);
    }
    if (workspace.owner.toString() === targetUserId.toString()) {
        throw new AppError('Cannot remove the workspace owner', 400);
    }

    workspace.members = workspace.members.filter(m => m.user.toString() !== targetUserId.toString());
    workspace.memberCount = workspace.members.length;
    await workspace.save();

    const target = await User.findById(targetUserId);
    await createActivity({
        userId,
        workspaceId: workspace._id,
        action: 'workspace.member_removed',
        description: `removed ${target?.name || 'a member'} from the workspace`,
    });

    emitToWorkspace(workspaceId, 'workspace:member-removed', { userId: targetUserId });
    return { message: 'Member removed' };
};


const updateMemberRole = async (workspaceId, userId, targetUserId, role) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (workspace.owner.toString() !== userId.toString()) {
        throw new AppError('Only the owner can change member roles', 403);
    }
    if (workspace.owner.toString() === targetUserId.toString()) {
        throw new AppError('Cannot change the owner\'s role', 400);
    }

    const member = workspace.members.find(m => m.user.toString() === targetUserId.toString());
    if (!member) throw new AppError('Member not found', 404);

    member.role = role;
    await workspace.save();

    await createActivity({
        userId,
        workspaceId: workspace._id,
        action: 'workspace.member_role_changed',
        description: `changed a member's role to ${role}`,
    });

    emitToWorkspace(workspaceId, 'workspace:member-role-changed', { userId: targetUserId, role });
    return { message: 'Role updated' };
};

module.exports = {
    createWorkspace, getUserWorkspaces, getWorkspace,
    updateWorkspace, deleteWorkspace,
    inviteMember, acceptInvite, removeMember, updateMemberRole,
};
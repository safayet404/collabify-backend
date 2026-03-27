require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('../config/db');

// Models
const User = require('../modules/auth/user.model');
const Workspace = require('../modules/workspace/workspace.model');
const Board = require('../modules/board/board.model');
const List = require('../modules/list/list.model');
const Card = require('../modules/card/card.model');
const Comment = require('../modules/comment/comment.model');
const Activity = require('../modules/activity/activity.model');
const Notification = require('../modules/notification/notification.model');

// ── Helpers ───────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const seed = async () => {
  await connectDB();
  console.log('\n🌱 Starting Collabify seed...\n');

  // ── CLEAN ──────────────────────────────────────────────────
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Workspace.deleteMany({}),
    Board.deleteMany({}),
    List.deleteMany({}),
    Card.deleteMany({}),
    Comment.deleteMany({}),
    Activity.deleteMany({}),
    Notification.deleteMany({}),
  ]);
  console.log('✅ Cleared\n');

  // ── USERS ──────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const userData = [
    { name: 'Alice Johnson', email: 'alice@collabify.io', color: '#4F46E5' },
    { name: 'Bob Smith', email: 'bob@collabify.io', color: '#7C3AED' },
    { name: 'Carol Williams', email: 'carol@collabify.io', color: '#DB2777' },
    { name: 'Dave Brown', email: 'dave@collabify.io', color: '#059669' },
    { name: 'Eve Davis', email: 'eve@collabify.io', color: '#D97706' },
    { name: 'Frank Miller', email: 'frank@collabify.io', color: '#DC2626' },
    { name: 'Grace Wilson', email: 'grace@collabify.io', color: '#0891B2' },
    { name: 'Henry Taylor', email: 'henry@collabify.io', color: '#2563EB' },
  ];

  const users = [];
  for (const u of userData) {
    const user = await User.create({
      name: u.name,
      email: u.email,
      password: 'Password1',
      color: u.color,
      bio: `Hi, I'm ${u.name.split(' ')[0]}! I love building great products.`,
      isEmailVerified: true,
    });
    users.push(user);
    console.log(`  ✅ ${u.name} (${u.email})`);
  }

  const [alice, bob, carol, dave, eve, frank, grace, henry] = users;

  // ── WORKSPACES ─────────────────────────────────────────────
  console.log('\n🏢 Creating workspaces...');

  // Workspace 1 — Tech team
  const ws1 = await Workspace.create({
    name: 'Acme Tech Team',
    description: 'Main workspace for the Acme engineering and product team.',
    color: '#4F46E5',
    owner: alice._id,
    members: [
      { user: alice._id, role: 'owner' },
      { user: bob._id, role: 'admin' },
      { user: carol._id, role: 'member' },
      { user: dave._id, role: 'member' },
      { user: eve._id, role: 'viewer' },
    ],
    memberCount: 5,
  });

  // Workspace 2 — Design team
  const ws2 = await Workspace.create({
    name: 'Design Studio',
    description: 'Creative workspace for the design and UX team.',
    color: '#DB2777',
    owner: carol._id,
    members: [
      { user: carol._id, role: 'owner' },
      { user: grace._id, role: 'admin' },
      { user: frank._id, role: 'member' },
      { user: alice._id, role: 'member' },
    ],
    memberCount: 4,
  });

  // Workspace 3 — Personal
  const ws3 = await Workspace.create({
    name: 'Bob\'s Personal',
    description: 'Personal workspace for side projects.',
    color: '#7C3AED',
    owner: bob._id,
    members: [{ user: bob._id, role: 'owner' }],
    memberCount: 1,
    isPersonal: true,
  });

  console.log(`  ✅ ${ws1.name}`);
  console.log(`  ✅ ${ws2.name}`);
  console.log(`  ✅ ${ws3.name}`);

  // ── BOARDS ─────────────────────────────────────────────────
  console.log('\n📋 Creating boards...');

  const defaultLabels = [
    { name: 'Bug', color: '#EF4444' },
    { name: 'Feature', color: '#8B5CF6' },
    { name: 'Design', color: '#EC4899' },
    { name: 'Backend', color: '#F59E0B' },
    { name: 'Frontend', color: '#10B981' },
    { name: 'Urgent', color: '#DC2626' },
  ];

  // Board 1 — Product Roadmap
  const board1 = await Board.create({
    title: 'Product Roadmap Q1 2025',
    description: 'Main product roadmap for Q1 2025 planning and execution.',
    workspace: ws1._id,
    createdBy: alice._id,
    background: { type: 'gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    visibility: 'workspace',
    labels: defaultLabels,
    members: [
      { user: alice._id, role: 'admin' },
      { user: bob._id, role: 'admin' },
      { user: carol._id, role: 'member' },
      { user: dave._id, role: 'member' },
      { user: eve._id, role: 'viewer' },
    ],
  });

  // Board 2 — Sprint Board
  const board2 = await Board.create({
    title: 'Sprint 23 — March 2025',
    description: 'Active sprint board for current development cycle.',
    workspace: ws1._id,
    createdBy: bob._id,
    background: { type: 'color', value: '#1e293b' },
    visibility: 'workspace',
    labels: defaultLabels,
    members: [
      { user: alice._id, role: 'admin' },
      { user: bob._id, role: 'admin' },
      { user: carol._id, role: 'member' },
      { user: dave._id, role: 'member' },
    ],
  });

  // Board 3 — Bug Tracker
  const board3 = await Board.create({
    title: 'Bug Tracker',
    description: 'Track and resolve all bugs and issues.',
    workspace: ws1._id,
    createdBy: alice._id,
    background: { type: 'color', value: '#dc2626' },
    visibility: 'workspace',
    labels: defaultLabels,
    members: [
      { user: alice._id, role: 'admin' },
      { user: bob._id, role: 'member' },
      { user: dave._id, role: 'member' },
    ],
  });

  // Board 4 — Design Board
  const board4 = await Board.create({
    title: 'UI/UX Projects',
    description: 'Design projects and component library work.',
    workspace: ws2._id,
    createdBy: carol._id,
    background: { type: 'gradient', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
    visibility: 'workspace',
    labels: defaultLabels,
    members: [
      { user: carol._id, role: 'admin' },
      { user: grace._id, role: 'member' },
      { user: frank._id, role: 'member' },
    ],
  });

  // Board 5 — Template
  const board5 = await Board.create({
    title: 'Agile Sprint Template',
    description: 'Reusable template for agile sprint planning.',
    workspace: ws1._id,
    createdBy: alice._id,
    background: { type: 'color', value: '#0f172a' },
    isTemplate: true,
    templateName: 'Agile Sprint',
    visibility: 'workspace',
    labels: defaultLabels,
    members: [{ user: alice._id, role: 'admin' }],
  });

  await Workspace.findByIdAndUpdate(ws1._id, { boardCount: 4 });
  await Workspace.findByIdAndUpdate(ws2._id, { boardCount: 1 });

  console.log(`  ✅ ${board1.title}`);
  console.log(`  ✅ ${board2.title}`);
  console.log(`  ✅ ${board3.title}`);
  console.log(`  ✅ ${board4.title}`);
  console.log(`  ✅ ${board5.title} (template)`);

  // ── LISTS ──────────────────────────────────────────────────
  console.log('\n📑 Creating lists...');

  // Board 1 lists
  const [l1_backlog, l1_todo, l1_inprogress, l1_review, l1_done] = await List.insertMany([
    { title: 'Backlog', board: board1._id, workspace: ws1._id, position: 0 },
    { title: 'To Do', board: board1._id, workspace: ws1._id, position: 1 },
    { title: 'In Progress', board: board1._id, workspace: ws1._id, position: 2 },
    { title: 'In Review', board: board1._id, workspace: ws1._id, position: 3 },
    { title: 'Done', board: board1._id, workspace: ws1._id, position: 4 },
  ]);

  // Board 2 lists (sprint)
  const [l2_todo, l2_inprogress, l2_testing, l2_done] = await List.insertMany([
    { title: 'To Do', board: board2._id, workspace: ws1._id, position: 0 },
    { title: 'In Progress', board: board2._id, workspace: ws1._id, position: 1, cardLimit: 4 },
    { title: 'Testing', board: board2._id, workspace: ws1._id, position: 2 },
    { title: 'Done', board: board2._id, workspace: ws1._id, position: 3 },
  ]);

  // Board 3 lists (bugs)
  const [l3_new, l3_confirmed, l3_fixing, l3_resolved] = await List.insertMany([
    { title: 'New', board: board3._id, workspace: ws1._id, position: 0 },
    { title: 'Confirmed', board: board3._id, workspace: ws1._id, position: 1 },
    { title: 'Fixing', board: board3._id, workspace: ws1._id, position: 2 },
    { title: 'Resolved', board: board3._id, workspace: ws1._id, position: 3 },
  ]);

  // Board 4 lists (design)
  const [l4_ideas, l4_design, l4_review, l4_delivered] = await List.insertMany([
    { title: 'Ideas', board: board4._id, workspace: ws2._id, position: 0 },
    { title: 'Designing', board: board4._id, workspace: ws2._id, position: 1 },
    { title: 'Review', board: board4._id, workspace: ws2._id, position: 2 },
    { title: 'Delivered', board: board4._id, workspace: ws2._id, position: 3 },
  ]);

  // Board 5 template lists
  await List.insertMany([
    { title: 'Backlog', board: board5._id, workspace: ws1._id, position: 0 },
    { title: 'Sprint', board: board5._id, workspace: ws1._id, position: 1 },
    { title: 'In Progress', board: board5._id, workspace: ws1._id, position: 2 },
    { title: 'Done', board: board5._id, workspace: ws1._id, position: 3 },
  ]);

  await Board.findByIdAndUpdate(board1._id, { listCount: 5 });
  await Board.findByIdAndUpdate(board2._id, { listCount: 4 });
  await Board.findByIdAndUpdate(board3._id, { listCount: 4 });
  await Board.findByIdAndUpdate(board4._id, { listCount: 4 });
  await Board.findByIdAndUpdate(board5._id, { listCount: 4 });

  console.log('  ✅ Lists created for all boards');

  // ── CARDS ──────────────────────────────────────────────────
  console.log('\n🃏 Creating cards...');

  const bugLabel = board1.labels[0];
  const featureLabel = board1.labels[1];
  const designLabel = board1.labels[2];
  const backendLabel = board1.labels[3];
  const frontendLabel = board1.labels[4];
  const urgentLabel = board1.labels[5];

  // Board 1 cards
  const board1Cards = [
    // Backlog
    {
      title: 'User authentication with OAuth',
      description: 'Implement Google and GitHub OAuth login alongside existing email auth.',
      list: l1_backlog._id, board: board1._id, workspace: ws1._id,
      position: 0, createdBy: alice._id,
      labels: [featureLabel, backendLabel],
      priority: 'high',
      storyPoints: 8,
      assignees: [bob._id],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, bob._id],
      checklists: [{
        title: 'Implementation Steps',
        items: [
          { text: 'Setup OAuth providers', isCompleted: false },
          { text: 'Create callback routes', isCompleted: false },
          { text: 'Store OAuth tokens', isCompleted: false },
          { text: 'Update user profile UI', isCompleted: false },
        ],
      }],
    },
    {
      title: 'Dark mode support',
      description: 'Add dark mode theme toggle with user preference persistence.',
      list: l1_backlog._id, board: board1._id, workspace: ws1._id,
      position: 1, createdBy: alice._id,
      labels: [featureLabel, frontendLabel],
      priority: 'medium',
      storyPoints: 5,
      assignees: [carol._id],
      watchers: [alice._id, carol._id],
    },
    {
      title: 'Export board to PDF',
      description: 'Allow users to export their board as a PDF snapshot.',
      list: l1_backlog._id, board: board1._id, workspace: ws1._id,
      position: 2, createdBy: bob._id,
      labels: [featureLabel],
      priority: 'low',
      storyPoints: 3,
      assignees: [dave._id],
      watchers: [bob._id, dave._id],
    },
    // To Do
    {
      title: 'Real-time notifications',
      description: 'Push notifications to users when they are mentioned, assigned, or when a due date approaches.',
      list: l1_todo._id, board: board1._id, workspace: ws1._id,
      position: 0, createdBy: alice._id,
      labels: [featureLabel, backendLabel],
      priority: 'high',
      storyPoints: 8,
      assignees: [bob._id, dave._id],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, bob._id, dave._id],
      checklists: [{
        title: 'Tasks',
        items: [
          { text: 'Socket.IO setup', isCompleted: true, completedBy: bob._id, completedAt: new Date() },
          { text: 'Notification model', isCompleted: true, completedBy: dave._id, completedAt: new Date() },
          { text: 'Frontend bell component', isCompleted: false },
          { text: 'Email notifications', isCompleted: false },
        ],
      }],
    },
    {
      title: 'Kanban board drag & drop',
      description: 'Implement drag and drop for cards between lists and reordering within lists using dnd-kit.',
      list: l1_todo._id, board: board1._id, workspace: ws1._id,
      position: 1, createdBy: bob._id,
      labels: [featureLabel, frontendLabel],
      priority: 'critical',
      storyPoints: 13,
      assignees: [carol._id],
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, bob._id, carol._id],
    },
    // In Progress
    {
      title: 'Card detail modal',
      description: 'Full card detail view with description editor, checklists, attachments, comments, activity log, and member assignment.',
      list: l1_inprogress._id, board: board1._id, workspace: ws1._id,
      position: 0, createdBy: alice._id,
      labels: [featureLabel, frontendLabel],
      priority: 'high',
      storyPoints: 8,
      assignees: [carol._id, alice._id],
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, carol._id],
      checklists: [{
        title: 'Components',
        items: [
          { text: 'Title & description', isCompleted: true, completedBy: carol._id, completedAt: new Date() },
          { text: 'Assignees section', isCompleted: true, completedBy: carol._id, completedAt: new Date() },
          { text: 'Labels section', isCompleted: true, completedBy: alice._id, completedAt: new Date() },
          { text: 'Checklist component', isCompleted: false },
          { text: 'Attachment upload', isCompleted: false },
          { text: 'Comment section', isCompleted: false },
          { text: 'Activity timeline', isCompleted: false },
        ],
      }],
    },
    {
      title: 'Search functionality',
      description: 'Global search across cards, boards, and workspaces with keyboard shortcut (Ctrl+K).',
      list: l1_inprogress._id, board: board1._id, workspace: ws1._id,
      position: 1, createdBy: bob._id,
      labels: [featureLabel, backendLabel, frontendLabel],
      priority: 'medium',
      storyPoints: 5,
      assignees: [bob._id],
      watchers: [alice._id, bob._id],
    },
    // In Review
    {
      title: 'Workspace settings page',
      description: 'Manage workspace name, description, members, and billing settings.',
      list: l1_review._id, board: board1._id, workspace: ws1._id,
      position: 0, createdBy: alice._id,
      labels: [featureLabel, frontendLabel],
      priority: 'medium',
      storyPoints: 5,
      assignees: [carol._id],
      watchers: [alice._id, carol._id],
    },
    // Done
    {
      title: 'Project foundation setup',
      description: 'Initial project setup — Next.js frontend, Express backend, MongoDB connection, JWT auth.',
      list: l1_done._id, board: board1._id, workspace: ws1._id,
      position: 0, createdBy: alice._id,
      labels: [backendLabel, frontendLabel],
      priority: 'none',
      storyPoints: 8,
      assignees: [alice._id, bob._id],
      isCompleted: true,
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, bob._id],
    },
    {
      title: 'User registration & login',
      description: 'Complete auth flow with JWT, refresh tokens, and password reset via email.',
      list: l1_done._id, board: board1._id, workspace: ws1._id,
      position: 1, createdBy: alice._id,
      labels: [backendLabel],
      priority: 'none',
      storyPoints: 5,
      assignees: [bob._id],
      isCompleted: true,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, bob._id],
    },
  ];

  // Board 3 bug cards
  const board3Cards = [
    {
      title: 'Login button not working on mobile Safari',
      description: 'The login button is unresponsive on iOS Safari 17. Works fine on Chrome and Firefox.',
      list: l3_new._id, board: board3._id, workspace: ws1._id,
      position: 0, createdBy: eve._id,
      labels: [bugLabel, urgentLabel],
      priority: 'critical',
      assignees: [carol._id],
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      watchers: [alice._id, carol._id, eve._id],
    },
    {
      title: 'Card drag-drop loses position on page refresh',
      description: 'After dragging cards, their positions are not persisted. Refreshing the page resets to original order.',
      list: l3_confirmed._id, board: board3._id, workspace: ws1._id,
      position: 0, createdBy: bob._id,
      labels: [bugLabel, frontendLabel],
      priority: 'high',
      assignees: [dave._id],
      watchers: [bob._id, dave._id],
    },
    {
      title: 'Email notifications not sending',
      description: 'SMTP configuration issue causing notification emails to fail silently.',
      list: l3_fixing._id, board: board3._id, workspace: ws1._id,
      position: 0, createdBy: alice._id,
      labels: [bugLabel, backendLabel],
      priority: 'high',
      assignees: [bob._id],
      watchers: [alice._id, bob._id],
    },
    {
      title: 'Profile avatar not updating in navbar',
      description: 'After uploading new avatar, the navbar still shows the old one until full page reload.',
      list: l3_resolved._id, board: board3._id, workspace: ws1._id,
      position: 0, createdBy: carol._id,
      labels: [bugLabel, frontendLabel],
      priority: 'low',
      assignees: [carol._id],
      isCompleted: true,
      watchers: [carol._id],
    },
  ];

  // Board 4 design cards
  const board4Cards = [
    {
      title: 'Redesign onboarding flow',
      description: 'Create a delightful onboarding experience with interactive tutorial for new users.',
      list: l4_ideas._id, board: board4._id, workspace: ws2._id,
      position: 0, createdBy: carol._id,
      labels: [board4.labels[2]], // Design
      priority: 'high',
      assignees: [carol._id],
      watchers: [carol._id, grace._id],
    },
    {
      title: 'Component library documentation',
      description: 'Document all UI components with usage examples in Storybook.',
      list: l4_design._id, board: board4._id, workspace: ws2._id,
      position: 0, createdBy: grace._id,
      labels: [board4.labels[2]],
      priority: 'medium',
      assignees: [grace._id, frank._id],
      watchers: [carol._id, grace._id],
    },
    {
      title: 'Mobile responsive audit',
      description: 'Audit all pages for mobile responsiveness and fix any layout issues.',
      list: l4_review._id, board: board4._id, workspace: ws2._id,
      position: 0, createdBy: carol._id,
      labels: [board4.labels[2], board4.labels[4]], // Design + Frontend
      priority: 'high',
      assignees: [frank._id],
      watchers: [carol._id, frank._id],
    },
    {
      title: 'Brand identity refresh',
      description: 'Updated logo, color palette, and typography delivered to dev team.',
      list: l4_delivered._id, board: board4._id, workspace: ws2._id,
      position: 0, createdBy: carol._id,
      labels: [board4.labels[2]],
      priority: 'none',
      assignees: [carol._id],
      isCompleted: true,
      watchers: [carol._id, alice._id],
    },
  ];

  const allCards = [...board1Cards, ...board3Cards, ...board4Cards];
  const createdCards = [];
  for (const cardData of allCards) {
    const card = await Card.create(cardData);
    createdCards.push(card);
  }

  // Update list and board counts
  const listCountMap = {};
  const boardCountMap = {};
  createdCards.forEach(c => {
    listCountMap[c.list] = (listCountMap[c.list] || 0) + 1;
    boardCountMap[c.board] = (boardCountMap[c.board] || 0) + 1;
  });

  for (const [listId, count] of Object.entries(listCountMap)) {
    await List.findByIdAndUpdate(listId, { cardCount: count });
  }
  for (const [boardId, count] of Object.entries(boardCountMap)) {
    await Board.findByIdAndUpdate(boardId, { cardCount: count });
  }

  console.log(`  ✅ ${createdCards.length} cards created`);

  // ── COMMENTS ──────────────────────────────────────────────
  console.log('\n💬 Creating comments...');

  const cardWithComments = createdCards[5]; // "Card detail modal"
  const comment1 = await Comment.create({
    card: cardWithComments._id,
    board: board1._id,
    workspace: ws1._id,
    author: alice._id,
    text: 'I\'ve started working on the title and description sections. Using TipTap for rich text — it supports @mentions which is great!',
    mentions: [carol._id],
  });

  const comment2 = await Comment.create({
    card: cardWithComments._id,
    board: board1._id,
    workspace: ws1._id,
    author: carol._id,
    text: '@alice Looks good! I\'ll pick up the assignees and labels sections. Should we use a dropdown or a popover for the member picker?',
    mentions: [alice._id],
  });

  const reply1 = await Comment.create({
    card: cardWithComments._id,
    board: board1._id,
    workspace: ws1._id,
    author: alice._id,
    text: 'Popover makes more sense UX-wise — similar to how Trello does it.',
    parentComment: comment2._id,
  });

  await Comment.findByIdAndUpdate(comment2._id, { $inc: { repliesCount: 1 } });

  const comment3 = await Comment.create({
    card: cardWithComments._id,
    board: board1._id,
    workspace: ws1._id,
    author: bob._id,
    text: 'The due date is approaching — let\'s make sure the checklist component is done by tomorrow. @carol @dave can you both sync up?',
    mentions: [carol._id, dave._id],
    reactions: [{ emoji: '👍', users: [alice._id, carol._id] }, { emoji: '🔥', users: [alice._id] }],
  });

  // Update card comments count
  await Card.findByIdAndUpdate(cardWithComments._id, { commentsCount: 3 });

  // Comment on bug card
  const bugCard = createdCards.find(c => c.title.includes('mobile Safari'));
  if (bugCard) {
    await Comment.create({
      card: bugCard._id,
      board: board3._id,
      workspace: ws1._id,
      author: carol._id,
      text: 'Reproduced on iPhone 14 Pro running iOS 17.4. The click event is firing but the form submission is being blocked. Looking into it now.',
    });
    await Comment.create({
      card: bugCard._id,
      board: board3._id,
      workspace: ws1._id,
      author: alice._id,
      text: 'This is blocking several users — marking as critical. @carol please prioritize.',
      mentions: [carol._id],
    });
    await Card.findByIdAndUpdate(bugCard._id, { commentsCount: 2 });
  }

  console.log('  ✅ Comments created');

  // ── ACTIVITY LOGS ──────────────────────────────────────────
  console.log('\n📋 Creating activity logs...');

  const activities = [
    { user: alice._id, workspace: ws1._id, board: board1._id, action: 'board.created', description: 'created board "Product Roadmap Q1 2025"' },
    { user: bob._id, workspace: ws1._id, board: board1._id, action: 'board.member_added', description: 'added Carol Williams to the board' },
    { user: alice._id, workspace: ws1._id, board: board1._id, action: 'list.created', description: 'created list "Backlog"' },
    { user: alice._id, workspace: ws1._id, board: board1._id, action: 'list.created', description: 'created list "In Progress"' },
    { user: bob._id, workspace: ws1._id, board: board1._id, action: 'card.created', description: 'created card "Real-time notifications"' },
    { user: carol._id, workspace: ws1._id, board: board1._id, action: 'card.updated', description: 'updated card "Card detail modal"' },
    { user: carol._id, workspace: ws1._id, board: board1._id, action: 'card.checklist_item_checked', description: 'checked "Title & description" in "Card detail modal"' },
    { user: alice._id, workspace: ws1._id, board: board1._id, action: 'comment.created', description: 'commented on "Card detail modal"' },
    { user: bob._id, workspace: ws1._id, board: board2._id, action: 'board.created', description: 'created board "Sprint 23"' },
    { user: alice._id, workspace: ws1._id, board: board3._id, action: 'card.created', description: 'created card "Email notifications not sending"' },
    { user: carol._id, workspace: ws2._id, board: board4._id, action: 'board.created', description: 'created board "UI/UX Projects"' },
    { user: grace._id, workspace: ws2._id, board: board4._id, action: 'card.created', description: 'created card "Component library documentation"' },
  ];

  await Activity.insertMany(activities.map((a, i) => ({
    ...a,
    createdAt: new Date(Date.now() - (activities.length - i) * 2 * 60 * 60 * 1000),
  })));

  console.log(`  ✅ ${activities.length} activity logs created`);

  // ── NOTIFICATIONS ──────────────────────────────────────────
  console.log('\n🔔 Creating notifications...');

  const notifications = [
    {
      recipient: alice._id,
      sender: bob._id,
      type: 'card.comment',
      title: 'New comment on "Card detail modal"',
      message: 'Bob Smith: The due date is approaching — let\'s make sure...',
      link: `/board/${board1._id}`,
      isRead: false,
    },
    {
      recipient: carol._id,
      sender: alice._id,
      type: 'card.mention',
      title: 'You were mentioned in "Card detail modal"',
      message: 'Alice Johnson mentioned you: @carol Looks good!',
      link: `/board/${board1._id}`,
      isRead: false,
    },
    {
      recipient: dave._id,
      sender: alice._id,
      type: 'card.assigned',
      title: 'Assigned to "Real-time notifications"',
      message: 'You were assigned to card "Real-time notifications"',
      link: `/board/${board1._id}`,
      isRead: false,
    },
    {
      recipient: carol._id,
      sender: alice._id,
      type: 'card.assigned',
      title: 'Assigned to "Login button not working on mobile Safari"',
      message: 'You were assigned to a critical bug fix',
      link: `/board/${board3._id}`,
      isRead: false,
    },
    {
      recipient: bob._id,
      sender: null,
      type: 'board.activity',
      title: 'New board created in Acme Tech Team',
      message: 'Alice created "Bug Tracker" in your workspace',
      link: `/board/${board3._id}`,
      isRead: true,
    },
    {
      recipient: alice._id,
      sender: carol._id,
      type: 'card.comment',
      title: 'Carol replied to a comment',
      message: 'Carol Williams: Popover makes more sense UX-wise...',
      link: `/board/${board1._id}`,
      isRead: true,
    },
  ];

  await Notification.insertMany(notifications.map(n => ({
    ...n,
    createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
  })));

  console.log(`  ✅ ${notifications.length} notifications created`);

  // ── SUMMARY ────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Collabify seed complete!\n');
  console.log('📊 Summary:');
  console.log(`  Users:         ${users.length}`);
  console.log(`  Workspaces:    3`);
  console.log(`  Boards:        5 (1 template)`);
  console.log(`  Lists:         ${5 + 4 + 4 + 4 + 4}`);
  console.log(`  Cards:         ${createdCards.length}`);
  console.log(`  Comments:      7`);
  console.log(`  Activities:    ${activities.length}`);
  console.log(`  Notifications: ${notifications.length}`);
  console.log('\n🔑 Demo Credentials (password: Password1):');
  console.log('  alice@collabify.io  — workspace owner, board admin');
  console.log('  bob@collabify.io    — workspace admin');
  console.log('  carol@collabify.io  — member, design lead');
  console.log('  dave@collabify.io   — member');
  console.log('  eve@collabify.io    — viewer');
  console.log('  frank@collabify.io  — design member');
  console.log('  grace@collabify.io  — design admin');
  console.log('  henry@collabify.io  — no workspace yet');
  console.log('═'.repeat(50) + '\n');

  process.exit(0);
};

seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
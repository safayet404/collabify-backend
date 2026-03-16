const express = require('express');
const router  = express.Router();
// TODO: implement board module
router.get('/', (req, res) => res.json({ success: true, message: 'board module coming soon' }));
module.exports = router;

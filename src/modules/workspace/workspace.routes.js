const express = require('express');
const router  = express.Router();
// TODO: implement workspace module
router.get('/', (req, res) => res.json({ success: true, message: 'workspace module coming soon' }));
module.exports = router;

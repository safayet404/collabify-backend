const express = require('express');
const router  = express.Router();
// TODO: implement search module
router.get('/', (req, res) => res.json({ success: true, message: 'search module coming soon' }));
module.exports = router;

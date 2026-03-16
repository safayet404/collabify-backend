const express = require('express');
const router  = express.Router();
// TODO: implement card module
router.get('/', (req, res) => res.json({ success: true, message: 'card module coming soon' }));
module.exports = router;

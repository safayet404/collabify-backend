const express = require('express');
const router  = express.Router();
// TODO: implement comment module
router.get('/', (req, res) => res.json({ success: true, message: 'comment module coming soon' }));
module.exports = router;

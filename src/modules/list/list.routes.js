const express = require('express');
const router  = express.Router();
// TODO: implement list module
router.get('/', (req, res) => res.json({ success: true, message: 'list module coming soon' }));
module.exports = router;

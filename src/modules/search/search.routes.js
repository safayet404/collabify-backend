const express = require('express');
const router = express.Router();
const ctrl = require('./search.controller');
const { protect } = require('../../middleware/auth.middleware');

router.use(protect);

router.get('/', ctrl.globalSearch);


router.get('/board/:boardId', ctrl.searchBoard);

router.get('/recent', ctrl.getRecent);

router.get('/mentions', ctrl.suggestMentions);

module.exports = router;
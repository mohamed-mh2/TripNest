const express=require('express');
const controller=require('../controllers/budget');
const {authenticate}=require('../middleware/auth');
const router=express.Router();
router.use(authenticate);
router.get('/',controller.list);
router.post('/expenses',controller.add);
router.delete('/expenses/:id',controller.remove);
module.exports=router;

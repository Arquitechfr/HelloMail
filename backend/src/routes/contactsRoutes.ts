import { Router } from 'express';
import * as contactsController from '../controllers/contactsController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createContactSchema, updateContactSchema } from '../schemas/contactSchemas.js';
import { objectIdParamSchema } from '../schemas/commonSchemas.js';

const router = Router();

router.get('/', requireAuth, contactsController.listContacts);
router.get('/search', requireAuth, contactsController.searchContacts);
router.get('/export', requireAuth, contactsController.exportContacts);
router.post('/import', requireAuth, contactsController.importContacts);
router.post('/', requireAuth, validate({ body: createContactSchema }), contactsController.createContact);
router.patch('/:id', requireAuth, validate({ params: objectIdParamSchema, body: updateContactSchema }), contactsController.updateContact);
router.delete('/:id', requireAuth, validate({ params: objectIdParamSchema }), contactsController.deleteContact);

export const contactsRoutes = router;

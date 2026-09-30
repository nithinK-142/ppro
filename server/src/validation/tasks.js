const { z } = require('zod');

const categories = [
  'Errands & Daily Tasks',
  'Home Services',
  'Travel & Tourism',
  'Health & Medical',
  'Senior Care',
  'Events & Management'
];

const taskListQuerySchema = z.object({
  search: z.string().trim().max(60).optional().default(''),
  category: z.enum(categories).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const selectionSchema = z.object({
  taskIds: z.array(z.number().int().positive()).min(1).max(30)
});

module.exports = { categories, taskListQuerySchema, selectionSchema };

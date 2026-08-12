const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const p = new PrismaClient();

// Simple bcrypt-compatible hash using Node.js built-in crypto
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

(async () => {
  try {
    const client = await p.client.findFirst();
    if (!client) {
      console.log('No clients found. Create a client first from /clients page.');
      process.exit();
    }
    console.log('Using client:', client.name, client.id);
    // Use bcryptjs from api package
    const bcrypt = require(require('path').join(__dirname, '../../apps/api/node_modules/bcryptjs'));
    const hash = await bcrypt.hash('client123', 10);
    const user = await p.clientPortalUser.create({
      data: {
        tenantId: client.tenantId,
        clientId: client.id,
        name: 'Portal User',
        email: 'portal@test.com',
        passwordHash: hash,
      },
    });
    console.log('Created portal user:', user.email, '/ password: client123');
  } catch (e) {
    console.error(e.message);
  }
  await p.$disconnect();
})();

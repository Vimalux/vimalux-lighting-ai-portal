const fs = require('fs');

const path = 'src/App.jsx';
let source = fs.readFileSync(path, 'utf8');

const unsafe = '  const isAgent = currentProfile?.role === "agent";';
const safe = `  // Fail closed: an authenticated user is restricted unless an admin role has been verified.\n  // This prevents profile/JWT lookup errors from exposing VIMALUX-only UI or write paths.\n  const roleVerified = currentProfile?.role === "admin" || currentProfile?.role === "agent";\n  const isAgent = currentProfile?.role === "agent" || (supabaseConfigured && Boolean(session) && currentProfile?.role !== "admin");`;

if (source.includes(unsafe)) {
  source = source.replace(unsafe, safe);
} else if (!source.includes('const roleVerified = currentProfile?.role === "admin"')) {
  throw new Error('Expected isAgent role gate not found in src/App.jsx');
}

fs.writeFileSync(path, source);

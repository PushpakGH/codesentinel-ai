let current = null;

function setSession(session) {
  current = session;
}

function getSession() {
  return current;
}

module.exports = { setSession, getSession };

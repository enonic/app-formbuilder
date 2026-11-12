/**
 * Creates an in-memory mock of /lib/xp/node for tests: one node list per branch, draft and master.
 *
 * Register its lib with t.mock('/lib/xp/node.js', mock.lib) before requiring the code under test.
 * It implements only what the form response code calls: connect() and, on the connection,
 * query, get, exists, create, modify, delete, getBinary and refresh. query understands
 * '<property> = "<value>"' on _parentPath and migratedFrom, nothing else.
 *
 * Besides the lib, the returned mock gives the test access to the stored nodes:
 *   reset()                     empties both branches and clears the failure switches
 *   seed(branch, node)          stores a node as given, _name and _parentPath derived from _path
 *   stored(node)                the node as the repo returns it
 *   nodes(branch)               all nodes of a branch, in creation order
 *   children(branch, path)      the nodes directly under a path
 *   get(branch, key)            the node with the given id or path, or null
 *   failCreate                  set to function(node) returning true to make create() throw
 *   missingBranch               set to a branch name to make query() on it throw
 * Everything returned is a copy, so a test never shares a node with the mock.
 */
exports.create = function() {
  const mock = {
    branches: {},
    counter: 0,
    failCreate: null,
    missingBranch: null
  };

  mock.lib = {
    connect: function(params) {
      return connect(mock, params.branch);
    }
  };
  mock.reset = function() {
    reset(mock);
  };
  mock.seed = function(branch, node) {
    mock.branches[branch].push(stored(node));
  };
  mock.stored = stored;
  mock.nodes = function(branch) {
    return clone(mock.branches[branch]);
  };
  mock.children = function(branch, parentPath) {
    return children(mock, branch, parentPath);
  };
  mock.get = function(branch, key) {
    return get(mock, branch, key);
  };

  reset(mock);
  return mock;
};

// *
// * Internal
// *

// Empties both branches and clears the failure switches.
function reset(mock) {
  mock.branches = { draft: [], master: [] };
  mock.counter = 0;
  mock.failCreate = null;
  mock.missingBranch = null;
}

// The node as the repo returns it: a copy with _name and _parentPath filled in from _path.
function stored(node) {
  const copy = clone(node);
  const split = copy._path.lastIndexOf('/');
  copy._name = copy._path.substring(split + 1);
  copy._parentPath = split === 0 ? '/' : copy._path.substring(0, split);
  return copy;
}

// Copies of the nodes directly under a path, in creation order.
function children(mock, branch, parentPath) {
  return clone(mock.branches[branch]).filter(function(node) {
    return node._parentPath === parentPath;
  });
}

// Copy of the node with the given id or path, or null.
function get(mock, branch, key) {
  const found = find(mock, branch, key);
  return found ? clone(found) : null;
}

// The stored node with the given id or path, or undefined.
function find(mock, branch, key) {
  return mock.branches[branch].filter(function(node) {
    return node._id === key || node._path === key;
  })[0];
}

// Connection to one branch, with the methods of a nodeLib.connect() result.
function connect(mock, branch) {
  return {
    query: function(params) {
      return query(mock, branch, params);
    },
    get: function(key) {
      return get(mock, branch, key);
    },
    exists: function(key) {
      return !!find(mock, branch, key);
    },
    create: function(node) {
      return create(mock, branch, node);
    },
    modify: function(params) {
      return modify(mock, branch, params);
    },
    'delete': function(keys) {
      return remove(mock, branch, keys);
    },
    getBinary: function(params) {
      return `binary:${params.key}:${params.binaryReference}`;
    },
    refresh: function() {}
  };
}

// Ids of the nodes whose property equals the value in the query, limited by count.
// Throws for a missing branch, like XP, and for any other kind of query.
function query(mock, branch, params) {
  if (mock.missingBranch === branch) {
    throw new Error(`Branch [${branch}] not found`);
  }
  const match = /^(_parentPath|migratedFrom) = "(.*)"$/.exec(params.query);
  if (!match) {
    throw new Error(`Query not supported by the mock node lib: ${params.query}`);
  }
  let hits = mock.branches[branch].filter(function(node) {
    return node[match[1]] === match[2];
  }).map(function(node) {
    return { id: node._id };
  });
  const total = hits.length;
  if (params.count >= 0) {
    hits = hits.slice(0, params.count);
  }
  return { total: total, count: hits.length, hits: hits };
}

// Stores a new node with a generated id, and a generated name when none is given.
// Throws when failCreate says so, or when a node exists at the same path, like XP.
function create(mock, branch, node) {
  if (mock.failCreate && mock.failCreate(node)) {
    throw new Error('Create failed on purpose');
  }
  mock.counter++;
  const parentPath = node._parentPath || '/';
  const name = node._name || `generated-${mock.counter}`;
  const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
  if (find(mock, branch, path)) {
    throw new Error(`Node already exists at ${path}`);
  }
  const created = clone(node);
  created._id = `new-${mock.counter}`;
  created._path = path;
  mock.branches[branch].push(stored(created));
  return get(mock, branch, created._id);
}

// Replaces a node with what the editor returns for a copy of it.
function modify(mock, branch, params) {
  const index = mock.branches[branch].indexOf(find(mock, branch, params.key));
  mock.branches[branch][index] = clone(params.editor(clone(mock.branches[branch][index])));
  return clone(mock.branches[branch][index]);
}

// Deletes the nodes with the given id or ids.
function remove(mock, branch, keys) {
  const ids = Array.isArray(keys) ? keys : [keys];
  mock.branches[branch] = mock.branches[branch].filter(function(node) {
    return ids.indexOf(node._id) < 0;
  });
  return ids;
}

// Deep copy, so tests and the code under test never share a node with the mock.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

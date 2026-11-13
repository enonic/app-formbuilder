const t = require('/lib/xp/testing');

const FORM_ID = 'form-a';
const RESPONSE_NAME = '[2026-11-12T15:53:15] Form A';

const mockNodeLib = require('/test/mock-node-lib').create();
t.mock('/lib/xp/node.js', mockNodeLib.lib);
t.mock('/lib/xp/value.js', {
  instant: function(value) {
    return { instant: value };
  },
  binary: function(name, stream) {
    return { name: name, stream: stream };
  }
});

// Required after the mocks: migration.js loads /lib/xp/node when it is required
const migration = require('/lib/form-builder/migration');

/**
 * Tests for the migration of 2.x form responses to the 3.x node layout.
 *
 * The node library is replaced by the in-memory mock in mock-node-lib.js, so the tests cover
 * the logic of the migration, not the behaviour of XP. Every test starts from a
 * draft branch holding what 2.x always created: /content and /content/_attachments.
 */
exports.before = function() {
  mockNodeLib.reset();
  mockNodeLib.seed('draft', { _id: 'content', _path: '/content' });
  mockNodeLib.seed('draft', { _id: 'folder', _path: '/content/_attachments', type: 'base:folder', displayName: '_attachments', data: {} });
};

exports.testCopiesResponseWithoutFiles = function() {
  mockNodeLib.seed('draft', legacyResponse('r1', { name: 'Ada', country: 'no', topics: ['news', 'sports'] }));

  const stats = migration.run();

  const responses = migratedResponses();
  equal(1, responses.length, 'one response on master');
  equal({
    _id: responses[0]._id,
    _name: RESPONSE_NAME,
    _parentPath: '/',
    _path: `/${RESPONSE_NAME}`,
    formContentId: FORM_ID,
    formDisplayName: 'Form A',
    submittedAt: { instant: '2026-11-12T18:53:15.965397Z' },
    data: { name: 'Ada', country: 'no', topics: ['news', 'sports'] },
    migratedFrom: 'r1',
    referer: 'http://localhost/form-a'
  }, responses[0], 'response node');
  equal({ responses: 1, files: 0, skipped: 0, failed: 0, deleted: 1, orphanFiles: 0 }, stats, 'stats');
};

exports.testCopiesSingleFileStoredAsObject = function() {
  mockNodeLib.seed('draft', legacyMedia('m1', 'hello.txt', 'text/plain', 14));
  mockNodeLib.seed('draft', legacyResponse('r1', { name: 'Bob', files: { attachments: legacyRef('m1', 'hello.txt') } }));

  const stats = migration.run();

  const response = migratedResponses()[0];
  const files = mockNodeLib.children('master', '/_attachments');
  equal(1, files.length, 'one file node');
  equal({
    _id: files[0]._id,
    _name: files[0]._name,
    _parentPath: '/_attachments',
    _path: files[0]._path,
    fileName: 'hello.txt',
    mimeType: 'text/plain',
    size: 14,
    binary: { name: 'hello.txt', stream: 'binary:m1:hello.txt' },
    migratedFrom: 'm1',
    formResponse: { id: response._id, formContentId: FORM_ID }
  }, files[0], 'file node');
  equal({ name: 'Bob', files: { attachments: [{ id: files[0]._id, name: 'hello.txt' }] } }, response.data, 'response data');
  equal(1, stats.files, 'files copied');
};

exports.testCopiesSeveralFilesStoredAsArray = function() {
  mockNodeLib.seed('draft', legacyMedia('m1', 'pixel.png', 'image/png', 70));
  mockNodeLib.seed('draft', legacyMedia('m2', 'notes.txt', 'text/plain', 25));
  mockNodeLib.seed('draft', legacyResponse('r1', {
    files: { attachments: [legacyRef('m1', 'pixel.png'), legacyRef('m2', 'notes.txt')] }
  }));

  const stats = migration.run();

  const response = migratedResponses()[0];
  const files = mockNodeLib.children('master', '/_attachments');
  equal(['pixel.png', 'notes.txt'], pluck(files, 'fileName'), 'file nodes');
  equal([
    { id: files[0]._id, name: 'pixel.png' },
    { id: files[1]._id, name: 'notes.txt' }
  ], response.data.files.attachments, 'refs point to the new file nodes, in order');
  equal([response._id, response._id], [files[0].formResponse.id, files[1].formResponse.id], 'both files linked');
  equal(2, stats.files, 'files copied');
};

exports.testDeletesMigratedContentFromDraft = function() {
  mockNodeLib.seed('draft', legacyMedia('m1', 'hello.txt', 'text/plain', 14));
  mockNodeLib.seed('draft', legacyResponse('r1', { files: { attachments: legacyRef('m1', 'hello.txt') } }));

  const stats = migration.run();

  equal(['content', 'folder'], pluck(mockNodeLib.nodes('draft'), '_id'), 'only the 2.x folders stay on draft');
  equal(1, stats.deleted, 'responses deleted');
};

exports.testLeavesOrphanFilesOnDraft = function() {
  const orphan = legacyMedia('m9', 'orphan.bin', 'application/octet-stream', 5120);
  mockNodeLib.seed('draft', orphan);
  mockNodeLib.seed('draft', legacyResponse('r1', { name: 'Ada' }));

  const stats = migration.run();

  equal(mockNodeLib.stored(orphan), mockNodeLib.get('draft', 'm9'), 'orphan untouched on draft');
  equal(0, mockNodeLib.children('master', '/_attachments').length, 'orphan not copied');
  equal(1, stats.orphanFiles, 'orphan counted');
};

exports.testSecondRunChangesNothing = function() {
  mockNodeLib.seed('draft', legacyMedia('m1', 'hello.txt', 'text/plain', 14));
  mockNodeLib.seed('draft', legacyResponse('r1', { files: { attachments: legacyRef('m1', 'hello.txt') } }));
  migration.run();
  const master = mockNodeLib.nodes('master');
  const draft = mockNodeLib.nodes('draft');

  const stats = migration.run();

  equal(master, mockNodeLib.nodes('master'), 'master unchanged');
  equal(draft, mockNodeLib.nodes('draft'), 'draft unchanged');
  equal({ responses: 0, files: 0, skipped: 0, failed: 0, deleted: 0, orphanFiles: 0 }, stats, 'stats');
};

exports.testCompletesRunInterruptedAfterFilesWereCopied = function() {
  mockNodeLib.seed('draft', legacyMedia('m1', 'hello.txt', 'text/plain', 14));
  mockNodeLib.seed('draft', legacyResponse('r1', { files: { attachments: legacyRef('m1', 'hello.txt') } }));
  mockNodeLib.seed('master', { _id: 'attachments', _path: '/_attachments' });
  mockNodeLib.seed('master', { _id: 'f1', _path: '/_attachments/f1', fileName: 'hello.txt', migratedFrom: 'm1' });

  const stats = migration.run();

  const response = migratedResponses()[0];
  equal(['f1'], pluck(mockNodeLib.children('master', '/_attachments'), '_id'), 'file not copied twice');
  equal([{ id: 'f1', name: 'hello.txt' }], response.data.files.attachments, 'response refers to the existing file');
  equal({ id: response._id, formContentId: FORM_ID }, mockNodeLib.get('master', 'f1').formResponse, 'file linked');
  equal(['content', 'folder'], pluck(mockNodeLib.nodes('draft'), '_id'), 'draft cleaned');
  equal({ responses: 1, files: 0, skipped: 0, failed: 0, deleted: 1, orphanFiles: 0 }, stats, 'stats');
};

exports.testCompletesRunInterruptedAfterResponseWasCopied = function() {
  mockNodeLib.seed('draft', legacyMedia('m1', 'hello.txt', 'text/plain', 14));
  mockNodeLib.seed('draft', legacyResponse('r1', { files: { attachments: legacyRef('m1', 'hello.txt') } }));
  mockNodeLib.seed('master', { _id: 'attachments', _path: '/_attachments' });
  mockNodeLib.seed('master', { _id: 'f1', _path: '/_attachments/f1', fileName: 'hello.txt', migratedFrom: 'm1' });
  mockNodeLib.seed('master', {
    _id: 'n1',
    _path: `/${RESPONSE_NAME}`,
    formContentId: FORM_ID,
    data: { files: { attachments: { id: 'f1', name: 'hello.txt' } } },
    migratedFrom: 'r1'
  });

  const stats = migration.run();

  equal(['n1'], pluck(migratedResponses(), '_id'), 'response not copied twice');
  equal({ id: 'n1', formContentId: FORM_ID }, mockNodeLib.get('master', 'f1').formResponse, 'file linked');
  equal(['content', 'folder'], pluck(mockNodeLib.nodes('draft'), '_id'), 'draft cleaned');
  equal({ responses: 0, files: 0, skipped: 1, failed: 0, deleted: 1, orphanFiles: 0 }, stats, 'stats');
};

exports.testKeepsNameOfMissingFile = function() {
  mockNodeLib.seed('draft', legacyResponse('r1', { files: { attachments: legacyRef('gone', 'hello.txt') } }));

  const stats = migration.run();

  const response = migratedResponses()[0];
  equal({ files: { attachments: [{ name: 'hello.txt' }] } }, response.data, 'ref keeps the name only');
  equal(0, mockNodeLib.children('master', '/_attachments').length, 'no file node');
  equal(['content', 'folder'], pluck(mockNodeLib.nodes('draft'), '_id'), 'response deleted from draft');
  equal({ responses: 1, files: 0, skipped: 0, failed: 0, deleted: 1, orphanFiles: 0 }, stats, 'stats');
};

exports.testFallsBackToGeneratedNameOnCollision = function() {
  mockNodeLib.seed('master', { _id: 'taken', _path: `/${RESPONSE_NAME}`, formContentId: FORM_ID });
  mockNodeLib.seed('draft', legacyResponse('r1', { name: 'Ada' }));

  const stats = migration.run();

  const responses = migratedResponses();
  equal(2, responses.length, 'both responses on master');
  equal('r1', responses[1].migratedFrom, 'migrated response stored');
  t.assertTrue(responses[1]._name !== RESPONSE_NAME, 'migrated response got a generated name');
  equal(1, stats.responses, 'responses copied');
};

exports.testFailedResponseIsLeftAndRetried = function() {
  mockNodeLib.seed('draft', legacyResponse('r1', { name: 'Ada' }, '[2026-11-12T15:53:15] Form A'));
  mockNodeLib.seed('draft', legacyMedia('m1', 'hello.txt', 'text/plain', 14));
  mockNodeLib.seed('draft', legacyResponse('r2', { files: { attachments: legacyRef('m1', 'hello.txt') } }, '[2026-11-12T15:53:44] Form A'));
  mockNodeLib.failCreate = function(node) {
    return node.migratedFrom === 'r2';
  };

  const failed = migration.run();

  equal(['r1'], pluck(migratedResponses(), 'migratedFrom'), 'the other response is migrated');
  equal(['content', 'folder', 'm1', 'r2'], pluck(mockNodeLib.nodes('draft'), '_id'), 'failed response and its file stay on draft');
  equal({ responses: 1, files: 1, skipped: 0, failed: 1, deleted: 1, orphanFiles: 0 }, failed, 'stats of the failed run');

  mockNodeLib.failCreate = null;
  const retried = migration.run();

  equal(['r1', 'r2'], pluck(migratedResponses(), 'migratedFrom'), 'failed response migrated by the next run');
  equal(1, mockNodeLib.children('master', '/_attachments').length, 'its file is not copied twice');
  equal(['content', 'folder'], pluck(mockNodeLib.nodes('draft'), '_id'), 'draft cleaned');
  equal({ responses: 1, files: 0, skipped: 0, failed: 0, deleted: 1, orphanFiles: 0 }, retried, 'stats of the retry');
};

exports.testReturnsQuietlyWithoutDraftBranch = function() {
  mockNodeLib.missingBranch = 'draft';

  const stats = migration.run();

  equal(0, mockNodeLib.nodes('master').length, 'master untouched');
  equal({ responses: 0, files: 0, skipped: 0, failed: 0, deleted: 0, orphanFiles: 0 }, stats, 'stats');
};

exports.testIgnoresOtherNodesUnderContent = function() {
  mockNodeLib.seed('draft', { _id: 'other', _path: '/content/other', type: 'base:unstructured', displayName: 'Other', data: { name: 'Ada' } });
  const draft = mockNodeLib.nodes('draft');

  const stats = migration.run();

  equal(0, mockNodeLib.nodes('master').length, 'nothing copied');
  equal(draft, mockNodeLib.nodes('draft'), 'draft unchanged');
  equal({ responses: 0, files: 0, skipped: 0, failed: 0, deleted: 0, orphanFiles: 0 }, stats, 'stats');
};

// *
// * Internal
// *

// Compares by JSON with sorted keys, so numbers and nested objects match on both
// script engines and property order does not matter.
function equal(expected, actual, message) {
  t.assertJson(sortKeys(expected), sortKeys(actual), message);
}

// Copy of a value with the keys of every object in alphabetical order.
function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach(function(key) {
      sorted[key] = sortKeys(value[key]);
    });
    return sorted;
  }
  return value;
}

// The response nodes on master: everything at the root except the files folder.
function migratedResponses() {
  return mockNodeLib.children('master', '/').filter(function(node) {
    return node._name !== '_attachments';
  });
}

// Values of one property across a list of nodes.
function pluck(nodes, property) {
  return nodes.map(function(node) {
    return node[property];
  });
}

// A 2.x response as stored on draft: content with the form metadata inside data.
function legacyResponse(id, data, displayName) {
  const legacy = {
    _id: id,
    _path: `/content/${id}`,
    type: 'base:unstructured',
    displayName: displayName || RESPONSE_NAME,
    createdTime: '2026-11-12T18:53:15.965397Z',
    data: {}
  };
  Object.keys(data).forEach(function(key) {
    legacy.data[key] = data[key];
  });
  legacy.data._formContentId = FORM_ID;
  legacy.data._formContentDisplayName = 'Form A';
  legacy.data._requestHeadersReferer = 'http://localhost/form-a';
  return legacy;
}

// A 2.x uploaded file as stored on draft: media content with its binary in attachment.
function legacyMedia(id, fileName, mimeType, size) {
  return {
    _id: id,
    _path: `/content/_attachments/${fileName}`,
    type: 'media:unknown',
    displayName: fileName,
    data: { media: { attachment: fileName } },
    attachment: { name: fileName, label: 'source', binary: fileName, mimeType: mimeType, size: size }
  };
}

// A 2.x attachment reference, including the dead url it carried.
function legacyRef(id, name) {
  return { id: id, name: name, url: `/_/attachment/download/${id}/${name}` };
}

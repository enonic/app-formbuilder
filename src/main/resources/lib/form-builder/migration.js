const nodeLib = require('/lib/xp/node'); // Import the node functions
const valueLib = require('/lib/xp/value'); // Import the value functions

const REPO_ID = 'com.enonic.formbuilder';
const ATTACHMENTS_NAME = '_attachments';
const ATTACHMENTS_PATH = '/' + ATTACHMENTS_NAME;

// 2.x kept these in the response data; 3.x stores them as node properties
const LEGACY_KEYS = ['_formContentId', '_formContentDisplayName', '_requestHeadersReferer'];

/**
 * Migrates the form responses stored by Form Builder 2.x to the 3.x node layout.
 *
 * 2.x stored responses and uploaded files as content on branch draft, under /content.
 * 3.x stores them as plain nodes on branch master: responses at the root, files under /_attachments.
 * Each response is copied together with its files, and its attachment references are
 * rewritten to the new file nodes.
 *
 * Safe to run on every app start. Every migrated node keeps the id of its 2.x source in
 * migratedFrom, so a later run skips it. An installation that never ran 2.x has nothing on
 * draft and returns at once. A response that fails is logged, left untouched and retried on
 * the next run.
 */
exports.run = function() {
  const draft = connect('draft');
  let hits;
  try {
    hits = draft.query({ query: '_parentPath = "/content"', sort: '_ts ASC', count: -1 }).hits;
  } catch (e) {
    // No draft branch: this installation never ran 2.x
    return;
  }

  const master = connect('master');
  // Nodes created by an interrupted run must be searchable before they are looked up
  master.refresh();
  const stats = { responses: 0, files: 0, skipped: 0, failed: 0 };

  hits.forEach(function(hit) {
    const legacy = draft.get(hit.id);
    if (!legacy || legacy.type !== 'base:unstructured' || !legacy.data || !legacy.data._formContentId) return;
    try {
      migrateResponse(draft, master, legacy, stats);
    } catch (e) {
      stats.failed++;
      log.error('Form Builder migration: could not migrate response ' + legacy._id, e);
    }
  });

  if (stats.responses || stats.skipped || stats.failed) {
    log.info('Form Builder migration: migrated ' + stats.responses + ' responses, ' + stats.files + ' files, ' +
      stats.skipped + ' skipped, ' + stats.failed + ' failed');
  }
};

// *
// * Internal
// *

// Connects to a branch of the formbuilder repo with admin privileges.
function connect(branch) {
  return nodeLib.connect({
    repoId: REPO_ID,
    branch: branch,
    principals: ['role:system.admin']
  });
}

// Copies one 2.x response and its files to master, then links the files to it.
// A response that was already copied only gets its file links completed.
function migrateResponse(draft, master, legacy, stats) {
  const migratedId = findMigrated(master, legacy._id);
  if (migratedId) {
    linkFiles(master, master.get(migratedId));
    stats.skipped++;
    return;
  }

  const data = {};
  Object.keys(legacy.data).forEach(function(key) {
    if (LEGACY_KEYS.indexOf(key) >= 0) return;
    const value = legacy.data[key];
    data[key] = hasAttachments(value) ? {
      attachments: forceArray(value.attachments).map(function(ref) {
        return migrateFile(draft, master, ref, stats);
      })
    } : value;
  });

  const node = {
    _parentPath: '/',
    formContentId: legacy.data._formContentId,
    formDisplayName: legacy.data._formContentDisplayName,
    submittedAt: valueLib.instant(legacy.createdTime || legacy._ts),
    data: data,
    migratedFrom: legacy._id
  };
  if (legacy.data._requestHeadersReferer) {
    node.referer = legacy.data._requestHeadersReferer;
  }

  const response = createResponse(master, node, legacy.displayName);
  linkFiles(master, response);
  stats.responses++;
}

// Creates the response node named like 2.x displayed it: "[timestamp] <form title>".
// Falls back to a generated name when that name is missing or already taken.
function createResponse(master, node, name) {
  if (name) {
    node._name = name;
    try {
      return master.create(node);
    } catch (e) {
      delete node._name;
    }
  }
  return master.create(node);
}

// Copies a 2.x media content to a file node under /_attachments and returns its new reference.
// A file that no longer exists keeps only its name, like a response stored without files.
function migrateFile(draft, master, ref, stats) {
  const media = ref.id ? draft.get(ref.id) : null;
  const attachment = media && media.attachment;
  if (!attachment || !attachment.name) {
    log.warning('Form Builder migration: file [' + ref.name + '] (' + ref.id + ') not found, keeping its name only');
    return { name: ref.name };
  }

  let fileId = findMigrated(master, media._id);
  if (!fileId) {
    fileId = master.create({
      _parentPath: getAttachmentsFolder(master),
      fileName: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      binary: valueLib.binary(attachment.name, draft.getBinary({
        key: media._id,
        binaryReference: attachment.name
      })),
      migratedFrom: media._id
    })._id;
    stats.files++;
  }
  return { id: fileId, name: attachment.name };
}

// Sets formResponse on the files of a response that do not have it yet.
// Files keep their response and form, so the response page can list them after a purge.
function linkFiles(master, response) {
  const data = response.data || {};
  Object.keys(data).forEach(function(key) {
    if (!hasAttachments(data[key])) return;
    forceArray(data[key].attachments).forEach(function(ref) {
      const file = ref.id ? master.get(ref.id) : null;
      if (file && !file.formResponse) {
        master.modify({
          key: file._id,
          editor: function(node) {
            node.formResponse = { id: response._id, formContentId: response.formContentId };
            return node;
          }
        });
      }
    });
  });
}

// Returns the id of the node on master that was created from the given 2.x node, or null.
function findMigrated(master, legacyId) {
  const hits = master.query({ query: 'migratedFrom = "' + legacyId + '"', count: 1 }).hits;
  return hits.length ? hits[0].id : null;
}

// Returns the path of the files folder on master, creating it on first use.
// A form submission may create it at the same time, hence the second check.
function getAttachmentsFolder(master) {
  if (!master.exists(ATTACHMENTS_PATH)) {
    try {
      master.create({
        _name: ATTACHMENTS_NAME,
        _parentPath: '/'
      });
    } catch (e) {
      if (!master.exists(ATTACHMENTS_PATH)) throw e;
    }
  }
  return ATTACHMENTS_PATH;
}

// True for a submitted value that holds uploaded files.
function hasAttachments(value) {
  return value && typeof value === 'object' && value.attachments;
}

// 2.x stored a single attachment as an object and several as an array.
function forceArray(value) {
  return Array.isArray(value) ? value : [value];
}

"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = _default;

var _path = require("path");

var _async = _interopRequireDefault(require("async"));

var _gaze = _interopRequireDefault(require("gaze"));

var _chalk = _interopRequireDefault(require("chalk"));

var _multimatch = _interopRequireDefault(require("multimatch"));

var _unyield = _interopRequireDefault(require("unyield"));

var _metalsmithFilenames = _interopRequireDefault(require("metalsmith-filenames"));

var _livereload = _interopRequireDefault(require("./livereload"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var jsFileRE = /\.(jsx?|es\d{0,1})$/;
var addFilenames = (0, _metalsmithFilenames["default"])();

var ok = _chalk["default"].green('✔︎');

var nok = _chalk["default"].red('✗'); // only first file that require something has it in its children
// so relying on children to invalidate sibling is not doable
// function invalidateCache(from, path, options) {
//   // we invalidate cache only for files in metalsmith root
//   if (require.cache[path] && path.indexOf(from) === 0) {
//     Object.keys(require.cache)
//       .filter(file => file.indexOf(from) === 0)
//       .filter(file => require.cache[file].children.indexOf(require.cache[path]) > -1)
//       .forEach(file => {
//         console.log(file, "is in children")
//         invalidateCache(from, file, options)
//       })
//
//     delete require.cache[path]
//     options.log(`${relativePath(from, path)} cache deleted`)
//     return true
//   }
//   return false
// }


function livereloadFiles(livereload, files, options) {
  if (livereload) {
    var keys = Object.keys(files);
    var nbOfFiles = Object.keys(files).length;
    options.log("".concat(ok, " ").concat(nbOfFiles, " file").concat(nbOfFiles > 1 ? 's' : '', " reloaded"));
    livereload.changed({
      body: {
        files: keys
      }
    });
  }
} // metalsmith-collections fix: collections are mutable
// fuck mutability


function backupCollections(collections) {
  var collectionsBackup = {};

  if (_typeof(collections) === 'object') {
    Object.keys(collections).forEach(function (key) {
      collectionsBackup[key] = _toConsumableArray(collections[key]);
    });
  }

  return collectionsBackup;
} // metalsmith-collections fix: collections are in metadata as is + under metadata.collections


function updateCollections(metalsmith, collections) {
  var metadata = _objectSpread({}, metalsmith.metadata(), {
    collections: collections
  }); // copy ref to metadata root since metalsmith-collections use this references
  // as primary location (*facepalm*)


  Object.keys(collections).forEach(function (key) {
    metadata[key] = collections[key];
  });
  metalsmith.metadata(metadata);
} // metalsmith-collections fix: helps to update fix collections


function saveFilenameInFilesData(files) {
  addFilenames(files);
} // metalsmith-collections fix: remove items from collections that will be readded by the partial build


function removeFilesFromCollection(files, collections) {
  var filenames = Object.keys(files);
  Object.keys(collections).forEach(function (key) {
    for (var i = 0; i < collections[key].length; i++) {
      if (filenames.indexOf(collections[key][i].filename) > -1) {
        collections[key] = [].concat(_toConsumableArray(collections[key].slice(0, i)), _toConsumableArray(collections[key].slice(i + 1)));
        i--;
      }
    }
  });
}

function runAndUpdate(metalsmith, files, livereload, options, previousFilesMap) {
  // metalsmith-collections fix: metalsmith-collections plugin add files to
  // collection when run() is called which create problem since we use run()
  // with only new files.
  // In order to prevent prevent duplicate issue (some contents will be available
  // in collections with the new and the previous version),
  // we remove from existing collections files that will be updated
  // (file already in the collections)
  // we iterate on collections with reference to previous files data
  // and skip old files that match the paths that will be updated
  saveFilenameInFilesData(files);
  var collections = metalsmith.metadata().collections;
  var collectionsBackup = backupCollections(collections);

  if (collections) {
    // mutability ftl :(
    removeFilesFromCollection(files, collections); // metalsmith-collections fix: prepare collections with partials items
    // run() below will add the new files to the collections

    updateCollections(metalsmith, collections);
  } // Set flag in global metadata object to allow downstream plugins to detect watch update runs


  var newMedata = _objectSpread({}, metalsmith.metadata(), {
    watchRun: true
  });

  metalsmith.metadata(newMedata);
  metalsmith.run(files, function (err, freshFiles) {
    if (err) {
      if (collections) {
        // metalsmith-collections fix: rollback collections
        updateCollections(metalsmith, collectionsBackup);
      }

      options.log(_chalk["default"].red("".concat(nok, " ").concat(err.toString()))); // babel use that to share information :)

      if (err.codeFrame) {
        err.codeFrame.split('\n').forEach(function (line) {
          return options.log(line);
        });
      }

      return;
    } // metalsmith-collections fix:  update ref for future tests


    Object.keys(freshFiles).forEach(function (path) {
      previousFilesMap[path] = freshFiles[path];
    });
    metalsmith.write(freshFiles, function (writeErr) {
      if (writeErr) {
        throw writeErr;
      }

      livereloadFiles(livereload, freshFiles, options);
    });
  });
}

function buildFiles(metalsmith, paths, livereload, options, previousFilesMap) {
  var files = {};

  _async["default"].each(paths, function (path, cb) {
    metalsmith.readFile(path, function (err, file) {
      if (err) {
        options.log(_chalk["default"].red("".concat(nok, " ").concat(err)));
        return;
      }

      files[path] = file;
      cb();
    });
  }, function (err) {
    if (err) {
      options.log(_chalk["default"].red("".concat(nok, " ").concat(err)));
      return;
    }

    var nbOfFiles = Object.keys(files).length;
    options.log(_chalk["default"].gray("- Updating ".concat(nbOfFiles, " file").concat(nbOfFiles > 1 ? 's' : '', "...")));
    runAndUpdate(metalsmith, files, livereload, options, previousFilesMap);
  });
}

function buildPattern(metalsmith, patterns, livereload, options, previousFilesMap) {
  (0, _unyield["default"])(metalsmith.read())(function (err, files) {
    if (err) {
      options.log(_chalk["default"].red("".concat(nok, " ").concat(err)));
      return;
    }

    var filesToUpdate = {};
    (0, _multimatch["default"])(Object.keys(files), patterns).forEach(function (path) {
      return filesToUpdate[path] = files[path];
    });
    var nbOfFiles = Object.keys(filesToUpdate).length;
    options.log(_chalk["default"].gray("- Updating ".concat(nbOfFiles, " file").concat(nbOfFiles > 1 ? 's' : '', "...")));
    runAndUpdate(metalsmith, filesToUpdate, livereload, options, previousFilesMap);
  });
}

function _default(options) {
  options = _objectSpread({}, {
    paths: '${source}/**/*',
    livereload: false,
    log: function log() {
      var _console;

      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      (_console = console).log.apply(_console, [_chalk["default"].gray('[metalsmith-watch]')].concat(args));
    },
    invalidateCache: true
  }, {}, options || {});

  if (typeof options.paths === 'string') {
    options.paths = _defineProperty({}, options.paths, true);
  }

  var livereload;

  if (options.livereload) {
    livereload = (0, _livereload["default"])(options.livereload, options.log);
  }

  var watched = false;

  var plugin = function metalsmithWatch(files, metalsmith, cb) {
    // only run this plugin once
    if (watched) {
      cb();
      return;
    }

    watched = true; // metalsmith-collections fix: keep filename as metadata

    saveFilenameInFilesData(files);
    var patterns = {};
    Object.keys(options.paths).map(function (pattern) {
      var watchPattern = pattern.replace('${source}', metalsmith.source());

      if (!(0, _path.isAbsolute)(watchPattern)) {
        watchPattern = (0, _path.resolve)(metalsmith.directory(), pattern);
      }

      var watchPatternRelative = (0, _path.relative)(metalsmith.directory(), watchPattern);
      patterns[watchPatternRelative] = options.paths[pattern];
    });
    (0, _gaze["default"])(Object.keys(patterns), _objectSpread({}, options.gaze, {
      cwd: metalsmith._directory
    }), function watcherReady(err, watcher) {
      if (err) {
        throw err;
      }

      Object.keys(patterns).forEach(function (pattern) {
        options.log("".concat(ok, " Watching ").concat(_chalk["default"].cyan(pattern)));
      });

      var previousFilesMap = _objectSpread({}, files); // Delay watch update to be able to bundle multiples update in the same build
      // Saving multiples files at the same time create multiples build otherwise


      var updateDelay = 50;
      var updatePlanned = false;
      var pathsToUpdate = [];

      var update = function update() {
        // since I can't find a way to do a smart cache cleaning
        // (see commented invalidateCache() method)
        // here is a more brutal way (that works)
        if (options.invalidateCache && // only if there is a js file
        pathsToUpdate.some(function (file) {
          return file.match(jsFileRE);
        })) {
          var filesToInvalidate = Object.keys(patterns).reduce(function (acc, pattern) {
            return [].concat(_toConsumableArray(acc), _toConsumableArray((0, _multimatch["default"])(Object.keys(require.cache), "".concat((0, _path.resolve)(metalsmith._directory), "/").concat(pattern))));
          }, []);

          if (filesToInvalidate.length) {
            options.log(_chalk["default"].gray("- Deleting cache for ".concat(filesToInvalidate.length, " entries...")));
            filesToInvalidate.forEach(function (file) {
              return delete require.cache[file];
            });
            options.log("".concat(ok, " Cache deleted"));
          }
        }

        var patternsToUpdate = Object.keys(patterns).filter(function (pattern) {
          return patterns[pattern] === true;
        });
        var filesToUpdate = (0, _multimatch["default"])(pathsToUpdate, patternsToUpdate).map(function (file) {
          var filepath = (0, _path.resolve)(metalsmith.path(), file);
          return (0, _path.relative)(metalsmith.source(), filepath);
        });

        if (filesToUpdate.length) {
          buildFiles(metalsmith, filesToUpdate, livereload, options, previousFilesMap);
        }

        var patternsToUpdatePattern = Object.keys(patterns).filter(function (pattern) {
          return patterns[pattern] !== true;
        }).filter(function (pattern) {
          return (0, _multimatch["default"])(pathsToUpdate, pattern).length > 0;
        }).map(function (pattern) {
          return patterns[pattern];
        });

        if (patternsToUpdatePattern.length) {
          buildPattern(metalsmith, patternsToUpdatePattern, livereload, options, previousFilesMap);
        } // console.log(pathsToUpdate, filesToUpdate, patternsToUpdatePattern);
        // cleanup


        pathsToUpdate = [];
      };

      watcher.on('all', function (event, path) {
        var filename = (0, _path.relative)(metalsmith._directory, path);

        if (event === 'added' || event === 'changed' || event === 'renamed' || event === 'deleted') {
          options.log("".concat(ok, " ").concat(_chalk["default"].cyan(filename), " ").concat(event));
        } // if (event === "changed") {
        //   if (options.invalidateCache) {
        //     invalidateCache(
        //       resolvePath(metalsmith._directory),
        //       resolvePath(path),
        //       options
        //     )
        //   }
        // }


        if (event === 'added' || event === 'changed' || event === 'renamed') {
          pathsToUpdate.push((0, _path.relative)(metalsmith.path(), path));

          if (updatePlanned) {
            clearTimeout(updatePlanned);
          }

          updatePlanned = setTimeout(update, updateDelay);
        }
      });

      plugin.close = function () {
        if (_typeof(watcher) === 'object') {
          watcher.close();
          watcher = undefined;
        }
      };
    });
    cb();
  }; // convenience for testing


  plugin.options = options;
  return plugin;
}

module.exports = exports.default;
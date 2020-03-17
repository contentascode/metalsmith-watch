"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = livereloadServer;

var _chalk = _interopRequireDefault(require("chalk"));

var _tinyLr = _interopRequireDefault(require("tiny-lr"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function livereloadServer(options, log) {
  if (options === true) {
    options = {
      port: 35729
    };
  } else if (typeof options === "number") {
    options = {
      port: options
    };
  }

  var server = (0, _tinyLr["default"])(options);
  server.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
      log(_chalk["default"].red("Port " + options.port + " is already in use by another process."));
    } else {
      log(_chalk["default"].red(err));
    }

    throw err;
  });
  server.listen(options.port, function (err) {
    if (err) {
      return log(_chalk["default"].red(err));
    }

    log("".concat(_chalk["default"].green("✓"), " Live reload server started on port: ").concat(_chalk["default"].cyan(options.port)));
  });
  return server;
}

module.exports = exports.default;
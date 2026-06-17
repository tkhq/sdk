"use strict";
/* eslint-disable-next-line no-unused-vars */
function __export(m) {
/* eslint-disable-next-line no-prototype-builtins */
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });

/* eslint-disable-next-line no-unused-vars */
var jtv = require('@mojotech/json-type-validation');
/* eslint-disable-next-line no-unused-vars */
var damlTypes = require('@daml/types');

exports.SrcLoc = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      srcLocPackage: damlTypes.Text.decoder,
      srcLocModule: damlTypes.Text.decoder,
      srcLocFile: damlTypes.Text.decoder,
      srcLocStartLine: damlTypes.Int.decoder,
      srcLocStartCol: damlTypes.Int.decoder,
      srcLocEndLine: damlTypes.Int.decoder,
      srcLocEndCol: damlTypes.Int.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      srcLocPackage: damlTypes.Text.encode(__typed__.srcLocPackage),
      srcLocModule: damlTypes.Text.encode(__typed__.srcLocModule),
      srcLocFile: damlTypes.Text.encode(__typed__.srcLocFile),
      srcLocStartLine: damlTypes.Int.encode(__typed__.srcLocStartLine),
      srcLocStartCol: damlTypes.Int.encode(__typed__.srcLocStartCol),
      srcLocEndLine: damlTypes.Int.encode(__typed__.srcLocEndLine),
      srcLocEndCol: damlTypes.Int.encode(__typed__.srcLocEndCol),
    };
  },
};

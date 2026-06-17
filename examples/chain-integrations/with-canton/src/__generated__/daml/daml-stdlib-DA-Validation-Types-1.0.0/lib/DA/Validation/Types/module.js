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

var pkgbde4bd30749e99603e5afa354706608601029e225d4983324d617825b634253a = require('@turnkey/daml-stdlib-DA-NonEmpty-Types-1.0.0');

exports.Validation = function (errs, a) {
  return ({
    decoder: damlTypes.lazyMemo(function () {
      return jtv.oneOf(
        jtv.object({
          tag: jtv.constant("Errors"),
          value: pkgbde4bd30749e99603e5afa354706608601029e225d4983324d617825b634253a.DA.NonEmpty.Types.NonEmpty(errs).decoder,
        }),
        jtv.object({
          tag: jtv.constant("Success"),
          value: a.decoder,
        }),
      );
    }),
    encode: function (__typed__) {
      switch(__typed__.tag) {
        case 'Errors': return {tag: __typed__.tag, value: pkgbde4bd30749e99603e5afa354706608601029e225d4983324d617825b634253a.DA.NonEmpty.Types.NonEmpty(errs).encode(__typed__.value)};
        case 'Success': return {tag: __typed__.tag, value: a.encode(__typed__.value)};
        default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type Validation';
      }
    },
  });
};

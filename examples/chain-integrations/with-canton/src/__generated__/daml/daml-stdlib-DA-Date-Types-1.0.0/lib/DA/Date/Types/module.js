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

exports.DayOfWeek = {
  Monday: 'Monday',
  Tuesday: 'Tuesday',
  Wednesday: 'Wednesday',
  Thursday: 'Thursday',
  Friday: 'Friday',
  Saturday: 'Saturday',
  Sunday: 'Sunday',
  keys: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.DayOfWeek.Monday),
      jtv.constant(exports.DayOfWeek.Tuesday),
      jtv.constant(exports.DayOfWeek.Wednesday),
      jtv.constant(exports.DayOfWeek.Thursday),
      jtv.constant(exports.DayOfWeek.Friday),
      jtv.constant(exports.DayOfWeek.Saturday),
      jtv.constant(exports.DayOfWeek.Sunday),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

exports.Month = {
  Jan: 'Jan',
  Feb: 'Feb',
  Mar: 'Mar',
  Apr: 'Apr',
  May: 'May',
  Jun: 'Jun',
  Jul: 'Jul',
  Aug: 'Aug',
  Sep: 'Sep',
  Oct: 'Oct',
  Nov: 'Nov',
  Dec: 'Dec',
  keys: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.constant(exports.Month.Jan),
      jtv.constant(exports.Month.Feb),
      jtv.constant(exports.Month.Mar),
      jtv.constant(exports.Month.Apr),
      jtv.constant(exports.Month.May),
      jtv.constant(exports.Month.Jun),
      jtv.constant(exports.Month.Jul),
      jtv.constant(exports.Month.Aug),
      jtv.constant(exports.Month.Sep),
      jtv.constant(exports.Month.Oct),
      jtv.constant(exports.Month.Nov),
      jtv.constant(exports.Month.Dec),
    );
  }),
  encode: function (__typed__) { return __typed__; },
};

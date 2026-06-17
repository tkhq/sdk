// Generated from ../../../DA/Validation/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkgbde4bd30749e99603e5afa354706608601029e225d4983324d617825b634253a from '@turnkey/daml-stdlib-DA-NonEmpty-Types-1.0.0';

export declare type Validation<errs, a> =
  | { tag: 'Errors'; value: pkgbde4bd30749e99603e5afa354706608601029e225d4983324d617825b634253a.DA.NonEmpty.Types.NonEmpty<errs> }
  | { tag: 'Success'; value: a }


export declare const Validation:
  <errs, a>(errs: damlTypes.Serializable<errs>, a: damlTypes.Serializable<a>) => damlTypes.Serializable<Validation<errs, a>>

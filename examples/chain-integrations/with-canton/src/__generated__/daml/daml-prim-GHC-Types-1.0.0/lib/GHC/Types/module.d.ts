// Generated from ../../GHC/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type Ordering =
  | 'LT'
  | 'EQ'
  | 'GT'


export declare const Ordering:
  damlTypes.Serializable<Ordering> & { readonly keys: Ordering[] } & { readonly [e in Ordering]: e }

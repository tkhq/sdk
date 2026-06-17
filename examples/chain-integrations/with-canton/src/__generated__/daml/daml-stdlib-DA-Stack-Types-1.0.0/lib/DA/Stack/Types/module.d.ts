// Generated from ../../../DA/Stack/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type SrcLoc = {
  srcLocPackage: string,
  srcLocModule: string,
  srcLocFile: string,
  srcLocStartLine: damlTypes.Int,
  srcLocStartCol: damlTypes.Int,
  srcLocEndLine: damlTypes.Int,
  srcLocEndCol: damlTypes.Int,
}

export declare const SrcLoc:
  damlTypes.Serializable<SrcLoc>

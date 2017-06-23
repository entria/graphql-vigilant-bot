// @flow

import { BreakingChangeType } from 'graphql';

const common = {
  wasRemoved: {
    //typeName + '.' + fieldName + ' was removed.'
    from: /(.*?) was removed/,
    to: '`$1` was removed',
  },
  wasRemovedFromX: {
    // value.name + ' was removed from X type ' + typeName + '.'
    from: /(.*?) was removed from (.*?) type (.*)./,
    to: '`$1` was removed from `$2` type `$3`.',
  },
};

export default {
  [BreakingChangeType.FIELD_CHANGED_KIND]: {
    //typeName + '.' + fieldName + ' changed type from ' + (oldFieldTypeString + ' to ' + newFieldTypeString + '.').
    title: '#### Field Changed',
    from: /(.*?) changed type from (.*?) to (.*)./,
    to: '`$1` changed type from `$2` to `$3`.',
  },
  [BreakingChangeType.FIELD_REMOVED]: {
    title: '#### Field Removed',
    from: common.wasRemoved.from,
    to: common.wasRemoved.to,
  },
  [BreakingChangeType.TYPE_CHANGED_KIND]: {
    //typeName + ' changed from ' + (typeKindName(oldType) + ' to ' + typeKindName(newType) + '.')
    title: '#### Type Changed Kind',
    from: /(.*?) changed from (.*?) to (.*)./,
    to: '`$1` changed from `$2` to `$3`.',
  },
  [BreakingChangeType.TYPE_REMOVED]: {
    title: '#### Type Removed',
    from: common.wasRemoved.from,
    to: common.wasRemoved.to,
  },
  [BreakingChangeType.TYPE_REMOVED_FROM_UNION]: {
    title: '#### Type Removed From Union',
    from: common.wasRemovedFromX.from,
    to: common.wasRemovedFromX.to,
  },
  [BreakingChangeType.VALUE_REMOVED_FROM_ENUM]: {
    title: '#### Value Removed From Enum',
    from: common.wasRemovedFromX.from,
    to: common.wasRemovedFromX.to,
  },
  [BreakingChangeType.ARG_REMOVED]: {
    //oldType.name + '.' + fieldName + ' arg ' + (oldArgDef.name + ' was removed')
    title: '#### Arg Removed',
    from: /(.*?) arg (.*?) was removed/,
    to: '`$1` arg `$2` was removed',
  },
  [BreakingChangeType.ARG_CHANGED_KIND]: {
    //oldType.name + '.' + fieldName + ' arg ' + (oldArgDef.name + ' has changed type from ')
    // + (oldArgDef.type.toString() + ' to ' + newArgDef.type.toString())
    title: '#### Arg Changed Kind',
    from: /(.*?) arg (.*?) has changed type from (.*?) to (.*)./,
    to: '`$1` arg `$2` has changed type from `$3` to `$4`.',
  },
  [BreakingChangeType.NON_NULL_ARG_ADDED]: {
    //'A non-null arg ' + newArgDef.name + ' on ' + (newType.name + '.' + fieldName + ' was added')
    title: '#### Non-null Arg Added',
    from: /A non-null arg (.*?) on (.*?) was added/,
    to: 'A non-null arg `$1` on `$2` was added',
  },
  [BreakingChangeType.NON_NULL_INPUT_FIELD_ADDED]: {
    //'A non-null field ' + fieldName + ' on ' + ('input type ' + newType.name + ' was added.'
    title: '#### Non-null Input Field Added',
    from: /A non-null field (.*?) on input type (.*?) was added/,
    to: 'A non-null field `$1` on input type `$2` was added',
  },
  [BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT]: {
    //typeName + ' no longer implements interface ' + (oldInterface.name + '.')
    title: '#### Interface Removed From Object',
    from: /(.*?) no longer implements interface (.*)./,
    to: '`$1` no longer implements interface `$2`.',
  },
};

import { redirect } from 'react-router';

import { paths } from '../../app/paths';

export function clientLoader() {
  return redirect(paths.parent.dashboard());
}

export default function ParentIndex() {
  return null;
}

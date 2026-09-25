import { redirect } from 'react-router';

import { paths } from '../../app/paths';

export function clientLoader() {
  return redirect(paths.child.home);
}

export default function ChildIndex() {
  return null;
}

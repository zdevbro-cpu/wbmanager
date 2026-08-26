import { api } from '../api/client';

interface TypeNode {
  id: string;
  level: number;
  name: string;
  children: TypeNode[];
}

// 업무 화면에서 문서를 만들 때 분류를 사람에게 묻지 않는다.
// 어디서 생긴 문서인지 알면 들어갈 자리도 정해져 있기 때문이다.
// 분류 이름은 바뀔 수 있으므로 경로로 찾고, 못 찾으면 위 단계에서 가장 가까운 자리를 쓴다.
export async function findDocTypeId(path: string[]): Promise<string | null> {
  const tree = await api.get<TypeNode[]>('/api/dms/types');

  let nodes = tree;
  let fallback: string | null = null;
  for (const name of path) {
    const hit = nodes.find((n) => n.name === name);
    if (!hit) break;
    fallback = hit.level === 3 ? hit.id : firstLeaf(hit) ?? fallback;
    if (hit.level === 3) return hit.id;
    nodes = hit.children;
  }
  return fallback;
}

function firstLeaf(node: TypeNode): string | null {
  if (node.level === 3) return node.id;
  for (const child of node.children) {
    const found = firstLeaf(child);
    if (found) return found;
  }
  return null;
}

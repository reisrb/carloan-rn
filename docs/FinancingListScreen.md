# FinancingListScreen

## Visão geral
A tela principal lista todos os financiamentos do usuário e os compartilhados. Ela exibe um **spinner** enquanto os dados e as imagens são carregados.

## Fluxo de carregamento
1. `load()` – busca financiamentos próprios (`financingService.getAll`) e compartilhados (`sharingService.getSharedWithMe`).
2. Calcula quantos pagamentos foram realizados por financiamento.
3. Coleta os caminhos das fotos (`carPhotoPath`) de financiamentos próprios e compartilhados.
4. **Pré‑cacheia** cada foto usando `imageService.getOrCachePhoto` (armazenado como base64 em `AsyncStorage`).
5. Atualiza os estados: `financings`, `sharedFinancings`, `paidCounts`.
6. `useFocusEffect` garante que ao focar a tela o loading volta a `true`, chama `load()` e só então oculta o spinner.

## UI
- Enquanto `loading === true` → `<ActivityIndicator>` central.
- Após carregamento → `FlatList` com itens:
  - Header “Meus financiamentos”.
  - Cada item renderiza `<FinancingCard>`.
  - Se não houver itens, mostra mensagem vazia.
  - Se houver compartilhados, adiciona seção “Financiamentos compartilhados”.
- Pull‑to‑refresh usa `RefreshControl`.
- Botão flutuante (`FAB`) abre `AddFinancingSheet`.

## Principais hooks / variáveis
- `useState` → `financings`, `sharedFinancings`, `paidCounts`, `loading`, `refreshing`, `showAdd`.
- `useFocusEffect` com `useCallback(load)`.
- `useNavigation` para navegar ao Dashboard (`navigation.navigate('Dashboard', …)`).

## Dependências externas
- `supabase` para consultas SQL.
- `imageService` (cache de fotos).
- `financingService`, `sharingService`.
- `useResponsive`, `useTheme` para styling.

## Como testar
```bash
npm run ios   # ou android
# Navegue até a tela inicial
# Observe o spinner até que todas as imagens estejam carregadas.
```

---

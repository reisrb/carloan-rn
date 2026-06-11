# FinancingCard

## Propósito
Renderiza cada item da lista de financiamentos mostrando:
- Foto do carro (cacheada em base64 via `imageService`).
- Nome do modelo, placa e banco (se houver).
- Barra de progresso com parcelas pagas.
- Ícone de navegação para a tela de detalhes.

## Props
- `financing: Financing` – objeto com dados do financiamento.
- `paidCount: number` – número de parcelas já pagas.
- `onPress: () => void` – callback ao tocar no card (navega para o Dashboard).

## Lógica de foto
```tsx
useEffect(() => {
  let active = true;
  if (financing.carPhotoPath) {
    imageService.getOrCachePhoto(financing.carPhotoPath).then(url => {
      if (active) setPhotoUrl(url);
    });
  } else {
    setPhotoUrl(null);
  }
  return () => { active = false; };
}, [financing.carPhotoPath]);
```
- Na primeira visita a foto é baixada e armazenada em `AsyncStorage`; nas visitas subsequentes o `url` vem instantaneamente do cache.

## UI
```tsx
<TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
  {photoUrl ? (
    <Image source={{ uri: photoUrl }} style={styles.photo} />
  ) : (
    <View style={[styles.photo, styles.photoPlaceholder]}>
      <Ionicons name="car-sport" size={28} color={theme.accentDark} />
    </View>
  )}
  <View style={styles.body}>
    <View style={styles.titleRow}>
      <Text style={styles.name} numberOfLines={1}>{financing.carName}</Text>
      {financing.licensePlate && (
        <View style={styles.plateBadge}>
          <Text style={styles.plateText}>{financing.licensePlate}</Text>
        </View>
      )}
    </View>
    {financing.bank && <Text style={styles.bank}>{financing.bank}</Text>}
    <View style={styles.progressRow}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{paidCount}/{financing.totalInstallments}</Text>
    </View>
  </View>
  <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
</TouchableOpacity>
```
- `progress` = `paidCount / financing.totalInstallments` (ou 0 se não houver parcelas).

## Estilização
Os estilos são criados em `makeStyles(theme)` usando tokens do tema: cor de fundo (`theme.card`), sombra (`theme.shadow`), cores de texto, etc.

---

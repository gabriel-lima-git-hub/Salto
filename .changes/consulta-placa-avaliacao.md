---
impacto: capacidade_nova
secao: adicionado
titulo: Consulta de placa na agenda e na ficha de avaliação
---

Com o módulo **avaliacao** ligado, o formulário de agendamento, a tela **Nova Avaliação** e o assistente da ficha ganham o botão **Consultar placa**. A instalação precisa do Bearer da API Brasil em `APIBRASIL_BEARER_TOKEN` no `.env` (opcionalmente `APIBRASIL_BASE_URL`); sem o token o botão responde que a consulta não está configurada. Cada consulta consome crédito do provedor e preenche marca/modelo no agendamento; na ficha também versão, anos, câmbio e combustível.

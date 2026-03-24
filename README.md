# ParkingSimulator

Simulador web 2D top-down feito com `HTML`, `CSS`, `JavaScript` puro e `PixiJS`.

O projeto inclui:

- via principal de acesso com curva de 90 graus;
- area de manobra;
- 3 vagas perpendiculares;
- modo automatico com 3 carros estacionando e saindo;
- modo manual com teclado;
- modelo cinematico simples de veiculo.

## Requisitos

- navegador moderno;
- conexao com a internet para carregar o `PixiJS` via CDN.

## Como executar

### Opcao 1: abrir direto no navegador

1. Entre na pasta do projeto.
2. Abra o arquivo `index.html` no navegador.

### Opcao 2: servir localmente

Se preferir rodar com um servidor estatico local:

```powershell
cd C:\Leonardo\Labs\CarParkingSimulator
python -m http.server 8000
```

Depois acesse:

`http://127.0.0.1:8000/index.html`

## Controles

- `Iniciar simulacao`: executa a entrada automatica dos carros.
- `Sair e ir embora`: faz os carros ja estacionados sairem da garagem.
- `Pausar`: pausa a simulacao.
- `Resetar tudo`: recria o cenario completo.
- `Resetar carro`: reseta o carro ativo no modo manual.
- `Modo Automatico/Manual`: alterna entre fila automatica e controle por teclado.

No modo manual:

- `W` / `Seta para cima`: acelera para frente;
- `S` / `Seta para baixo`: re;
- `A` / `Seta para esquerda`: esterca para a esquerda;
- `D` / `Seta para direita`: esterca para a direita;
- `Espaco`: freio.

## Estrutura

- `index.html`: estrutura da pagina;
- `styles.css`: interface e painel lateral;
- `js/config.js`: configuracoes e presets dos veiculos;
- `js/geometry.js`: utilitarios geometricos;
- `js/layout.js`: geometria da garagem e trajetorias;
- `js/car.js`: modelo do carro e logica de movimento;
- `js/scene.js`: renderizacao com PixiJS;
- `js/ui.js`: bindings da interface;
- `js/simulation.js`: controlador principal da simulacao;
- `js/main.js`: bootstrap da aplicacao.

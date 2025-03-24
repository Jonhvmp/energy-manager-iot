# Getting Started

Este guia explica como configurar o Mosquitto e rodar os exemplos da biblioteca Energy Manager IoT.

## 1. Instalando o Mosquitto

### Windows
- Baixe o instalador do Mosquitto em [https://mosquitto.org/download/](https://mosquitto.org/download/).
- Siga as instruções do instalador e, se necessário, adicione o Mosquitto ao PATH do sistema.
- Para iniciar o broker, abra o prompt de comando e execute:
  ```bash
  mosquitto -v
  ```

### Linux (Debian/Ubuntu)
- Instale com os comandos:
  ```bash
  sudo apt update
  sudo apt install mosquitto mosquitto-clients
  ```
- Inicie o broker:
  ```bash
  sudo systemctl start mosquitto
  ```
- Para verificar o status:
  ```bash
  sudo systemctl status mosquitto
  ```

### macOS
- Instale via Homebrew:
  ```bash
  brew install mosquitto
  ```
- Inicie o broker:
  ```bash
  brew services start mosquitto
  ```

## 2. Configurando o Mosquitto

Os arquivos de configuração padrão geralmente funcionam bem para testes. Se precisar de personalizações, edite o arquivo de configuração (ex.: /etc/mosquitto/mosquitto.conf no Linux).

## 3. Rodando os exemplos

Após configurar o Mosquitto, você pode testar a biblioteca:

1. Faça a build do projeto (caso ainda não tenha feito):
   ```bash
   npm run build
   ```

2. Execute um exemplo, por exemplo:
   ```bash
   npm run example:basic
   ```
   Ou para gerenciamento de grupos:
   ```bash
   npm run example:group
   ```

3. Verifique os logs e mensagens de status no console para confirmar a comunicação com o broker MQTT.

## 4. Continue explorando

Para mais detalhes, consulte o arquivo [README.md](./README.md) e a documentação da biblioteca.

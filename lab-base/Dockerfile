FROM node:20

# Instalamos dependencias solo una vez para acelerar los labs
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       openssh-server postgresql postgresql-contrib sudo nano \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/run/sshd

# Dejar el entrypoint vacío; el compose del lab define el comando

FROM ubuntu:latest

COPY buildnote-linux /usr/local/bin/buildnote
COPY buildnote.sh /usr/local/bin

RUN chmod +x /usr/local/bin/buildnote
RUN chmod +x /usr/local/bin/buildnote.sh

ENTRYPOINT ["buildnote.sh"]


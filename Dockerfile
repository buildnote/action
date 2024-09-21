FROM ubuntu:22.04

COPY buildnote /usr/local/bin
COPY buildnote.sh /usr/local/bin

RUN chmod +x /usr/local/bin/buildnote
RUN chmod +x /usr/local/bin/buildnote.sh

ENTRYPOINT ["buildnote.sh"]

